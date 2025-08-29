/**
 * Code scanner for detecting data surface usage patterns
 * Uses ts-morph for AST analysis to find fetch, axios, GraphQL, Supabase, etc.
 */
import { Project, SourceFile, CallExpression, PropertyAccessExpression, ImportDeclaration, Node, ts } from 'ts-morph';
import { glob } from 'glob';
import { join, relative } from 'path';
import type { DSMEntry, DataSurfaceKind, ScanOptions, ScanResult } from './types.js';

export class CodeScanner {
  private project: Project;
  private rootPath: string;
  private entries: DSMEntry[] = [];
  private errors: string[] = [];
  private scannedFiles = 0;

  constructor(options: ScanOptions) {
    this.rootPath = options.rootPath;
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true
    });
  }

  /**
   * Scan the project for data surface usage
   */
  async scan(): Promise<ScanResult> {
    console.log(`🔍 Scanning project at: ${this.rootPath}`);
    
    // Find all TypeScript and JavaScript files
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx'
    ];

    const excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts',
      '**/.next/**',
      '**/coverage/**'
    ];

    let allFiles: string[] = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.rootPath,
        absolute: true,
        ignore: excludePatterns
      });
      allFiles.push(...files);
    }

    // Remove duplicates
    allFiles = [...new Set(allFiles)];
    
    console.log(`📁 Found ${allFiles.length} files to analyze`);

    // Add files to project and analyze
    for (const filePath of allFiles) {
      try {
        const sourceFile = this.project.addSourceFileAtPath(filePath);
        this.analyzeFile(sourceFile);
        this.scannedFiles++;
      } catch (error) {
        this.errors.push(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return this.createResult(allFiles.length);
  }

  /**
   * Analyze a single source file for data surface patterns
   */
  private analyzeFile(sourceFile: SourceFile): void {
    const filePath = relative(this.rootPath, sourceFile.getFilePath());
    
    // Get imports to understand what libraries are being used
    const imports = this.getImports(sourceFile);
    
    // Find all call expressions using proper ts-morph API
    const callExpressions = sourceFile.getDescendantsOfKind(ts.SyntaxKind.CallExpression);
    callExpressions.forEach(callExpr => {
      this.analyzeCallExpression(callExpr, filePath, imports);
    });

    const propertyAccesses = sourceFile.getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression);
    propertyAccesses.forEach(propAccess => {
      // Check if this is part of a call expression
      const parent = propAccess.getParent();
      if (parent?.getKind() === ts.SyntaxKind.CallExpression) {
        this.analyzePropertyAccess(propAccess, filePath, imports);
      }
    });
  }

  /**
   * Get imports from a source file
   */
  private getImports(sourceFile: SourceFile): Map<string, string> {
    const imports = new Map<string, string>();
    
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Named imports
      importDecl.getNamedImports().forEach(namedImport => {
        imports.set(namedImport.getName(), moduleSpecifier);
      });
      
      // Default import
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        imports.set(defaultImport.getText(), moduleSpecifier);
      }
      
      // Namespace import
      const namespaceImport = importDecl.getNamespaceImport();
      if (namespaceImport) {
        imports.set(namespaceImport.getText(), moduleSpecifier);
      }
    });
    
    return imports;
  }

  /**
   * Analyze call expressions for data surface patterns
   */
  private analyzeCallExpression(callExpr: CallExpression, filePath: string, imports: Map<string, string>): void {
    const callText = callExpr.getExpression().getText();
    const line = callExpr.getStartLineNumber();
    const fullCall = callExpr.getText().split('\n')[0]; // First line only
    
    // Detect fetch calls
    if (callText === 'fetch' || callText.includes('fetch')) {
      this.addEntry({
        file: filePath,
        line,
        kind: 'fetch',
        call: fullCall,
        ...this.analyzeFetchCall(callExpr, imports)
      });
      return;
    }

    // Detect axios calls
    if (callText.includes('axios') || imports.get(callText.split('.')[0]) === 'axios') {
      this.addEntry({
        file: filePath,
        line,
        kind: 'axios',
        call: fullCall,
        ...this.analyzeAxiosCall(callExpr, imports)
      });
      return;
    }

    // Detect GraphQL patterns
    if (this.isGraphQLCall(callText, imports)) {
      const kind = this.getGraphQLKind(callText, imports);
      this.addEntry({
        file: filePath,
        line,
        kind,
        call: fullCall,
        ...this.analyzeGraphQLCall(callExpr, imports, kind)
      });
      return;
    }

    // Detect React Query / SWR
    if (this.isQueryHook(callText, imports)) {
      const kind = callText.startsWith('use') && callText.includes('SWR') ? 'swr' : 'react-query';
      this.addEntry({
        file: filePath,
        line,
        kind,
        call: fullCall,
        ...this.analyzeQueryHook(callExpr, imports)
      });
      return;
    }
  }

  /**
   * Analyze property access expressions (e.g., supabase.from(), prisma.user.findMany())
   */
  private analyzePropertyAccess(propAccess: PropertyAccessExpression, filePath: string, imports: Map<string, string>): void {
    const fullText = propAccess.getText();
    const line = propAccess.getStartLineNumber();
    
    // Check if this is part of a call expression
    const parent = propAccess.getParent();
    if (parent?.getKind() !== ts.SyntaxKind.CallExpression) return; // Not a call expression
    
    const callExpr = parent as CallExpression;
    const fullCall = callExpr.getText().split('\n')[0];
    
    // Detect Supabase patterns
    if (this.isSupabaseCall(fullText, imports)) {
      this.addEntry({
        file: filePath,
        line,
        kind: 'supabase',
        call: fullCall,
        ...this.analyzeSupabaseCall(callExpr, imports)
      });
      return;
    }

    // Detect Prisma patterns
    if (this.isPrismaCall(fullText, imports)) {
      this.addEntry({
        file: filePath,
        line,
        kind: 'prisma',
        call: fullCall,
        ...this.analyzePrismaCall(callExpr, imports)
      });
      return;
    }

    // Detect Drizzle patterns
    if (this.isDrizzleCall(fullText, imports)) {
      this.addEntry({
        file: filePath,
        line,
        kind: 'drizzle',
        call: fullCall,
        ...this.analyzeDrizzleCall(callExpr, imports)
      });
      return;
    }
  }

  /**
   * Analyze fetch calls for injectability
   */
  private analyzeFetchCall(callExpr: CallExpression, imports: Map<string, string>): Pick<DSMEntry, 'injectable' | 'reason' | 'metadata'> {
    const args = callExpr.getArguments();
    if (args.length === 0) {
      return { injectable: 'no', reason: 'No URL argument provided' };
    }

    const urlArg = args[0].getText();
    
    // Check for relative URLs (good for injection)
    if (urlArg.includes("'/api/") || urlArg.includes('"/api/') || urlArg.includes('`/api/')) {
      return { 
        injectable: 'yes', 
        reason: 'Relative API URL detected',
        metadata: { urlPattern: urlArg }
      };
    }
    
    // Check for template literals with variables
    if (urlArg.includes('${') || urlArg.includes('`')) {
      return { 
        injectable: 'maybe', 
        reason: 'Dynamic URL construction - needs review',
        metadata: { urlPattern: urlArg }
      };
    }
    
    // Check for external URLs
    if (urlArg.includes('http://') || urlArg.includes('https://')) {
      return { 
        injectable: 'no', 
        reason: 'External URL - not suitable for fixture injection',
        metadata: { urlPattern: urlArg }
      };
    }
    
    return { 
      injectable: 'maybe', 
      reason: 'URL pattern needs manual review',
      metadata: { urlPattern: urlArg }
    };
  }

  /**
   * Analyze axios calls
   */
  private analyzeAxiosCall(callExpr: CallExpression, imports: Map<string, string>): Pick<DSMEntry, 'injectable' | 'reason' | 'metadata'> {
    const args = callExpr.getArguments();
    const method = callExpr.getExpression().getText();
    
    if (method.includes('.get') || method.includes('.post') || method.includes('.put') || method.includes('.delete')) {
      return { 
        injectable: 'yes', 
        reason: 'Axios HTTP method call - interceptable',
        metadata: { method: method.split('.').pop() }
      };
    }
    
    return { 
      injectable: 'maybe', 
      reason: 'Axios call - review configuration',
      metadata: { method: 'unknown' }
    };
  }

  /**
   * Analyze Supabase calls
   */
  private analyzeSupabaseCall(callExpr: CallExpression, imports: Map<string, string>): Pick<DSMEntry, 'injectable' | 'reason' | 'metadata'> {
    const callText = callExpr.getText();
    
    if (callText.includes('.from(') && callText.includes('.select(')) {
      return { 
        injectable: 'yes', 
        reason: 'Supabase query - perfect for fixture replacement',
        metadata: { operation: 'query' }
      };
    }
    
    if (callText.includes('.insert(') || callText.includes('.update(') || callText.includes('.delete(')) {
      return { 
        injectable: 'maybe', 
        reason: 'Supabase mutation - consider read-only fixtures',
        metadata: { operation: 'mutation' }
      };
    }
    
    return { 
      injectable: 'yes', 
      reason: 'Supabase call - generally injectable',
      metadata: { operation: 'unknown' }
    };
  }

  /**
   * Analyze other call types with basic heuristics
   */
  private analyzePrismaCall(callExpr: CallExpression, imports: Map<string, string>): Pick<DSMEntry, 'injectable' | 'reason' | 'metadata'> {
    const callText = callExpr.getText();
    
    if (callText.includes('.findMany') || callText.includes('.findFirst') || callText.includes('.findUnique')) {
      return { injectable: 'yes', reason: 'Prisma read operation - good for fixtures' };
    }
    
    if (callText.includes('.create') || callText.includes('.update') || callText.includes('.delete')) {
      return { injectable: 'maybe', reason: 'Prisma write operation - consider read-only fixtures' };
    }
    
    return { injectable: 'maybe', reason: 'Prisma call - review for fixture compatibility' };
  }

  private analyzeDrizzleCall(callExpr: CallExpression, imports: Map<string, string>): Pick<DSMEntry, 'injectable' | 'reason' | 'metadata'> {
    return { injectable: 'maybe', reason: 'Drizzle ORM call - needs custom fixture strategy' };
  }

  private analyzeGraphQLCall(callExpr: CallExpression, imports: Map<string, string>, kind: DataSurfaceKind): Pick<DSMEntry, 'injectable' | 'reason' | 'metadata'> {
    return { injectable: 'yes', reason: 'GraphQL call - interceptable at HTTP layer' };
  }

  private analyzeQueryHook(callExpr: CallExpression, imports: Map<string, string>): Pick<DSMEntry, 'injectable' | 'reason' | 'metadata'> {
    return { injectable: 'yes', reason: 'Query hook - works with HTTP interception' };
  }

  /**
   * Helper methods for pattern detection
   */
  private isGraphQLCall(callText: string, imports: Map<string, string>): boolean {
    const rootVar = callText.split('.')[0];
    const module = imports.get(rootVar);
    
    return callText.includes('gql') || 
           callText.includes('useQuery') || 
           callText.includes('useMutation') ||
           (imports.has(rootVar) && 
            Boolean(module?.includes('graphql') || module?.includes('apollo')));
  }

  private getGraphQLKind(callText: string, imports: Map<string, string>): DataSurfaceKind {
    const rootModule = imports.get(callText.split('.')[0]);
    if (rootModule?.includes('apollo')) return 'apollo-client';
    if (rootModule?.includes('graphql-request')) return 'graphql-request';
    return 'graphql-request';
  }

  private isQueryHook(callText: string, imports: Map<string, string>): boolean {
    return callText.startsWith('use') && 
           (callText.includes('Query') || callText.includes('SWR') || callText.includes('Mutation'));
  }

  private isSupabaseCall(fullText: string, imports: Map<string, string>): boolean {
    const parts = fullText.split('.');
    const rootVar = parts[0];
    return imports.get(rootVar) === '@supabase/supabase-js' || 
           fullText.includes('supabase.') ||
           (parts.length > 1 && (parts[1] === 'from' || parts[1] === 'auth' || parts[1] === 'storage'));
  }

  private isPrismaCall(fullText: string, imports: Map<string, string>): boolean {
    const parts = fullText.split('.');
    const rootVar = parts[0];
    return imports.get(rootVar) === '@prisma/client' || 
           fullText.includes('prisma.') ||
           (parts.length > 2 && (parts[2]?.includes('find') || parts[2]?.includes('create') || parts[2]?.includes('update')));
  }

  private isDrizzleCall(fullText: string, imports: Map<string, string>): boolean {
    const parts = fullText.split('.');
    const rootVar = parts[0];
    return imports.get(rootVar)?.includes('drizzle') || fullText.includes('drizzle');
  }

  /**
   * Add entry to results
   */
  private addEntry(entry: DSMEntry): void {
    this.entries.push(entry);
  }

  /**
   * Create final scan result
   */
  private createResult(totalFiles: number): ScanResult {
    const byKind: Record<DataSurfaceKind, number> = {
      'fetch': 0,
      'axios': 0,
      'graphql-request': 0,
      'apollo-client': 0,
      'supabase': 0,
      'prisma': 0,
      'drizzle': 0,
      'react-query': 0,
      'swr': 0,
      'unknown': 0
    };

    const byInjectability: Record<'yes' | 'maybe' | 'no', number> = {
      'yes': 0,
      'maybe': 0,
      'no': 0
    };

    this.entries.forEach(entry => {
      byKind[entry.kind]++;
      byInjectability[entry.injectable]++;
    });

    return {
      summary: {
        totalFiles,
        scannedFiles: this.scannedFiles,
        totalEntries: this.entries.length,
        byKind,
        byInjectability
      },
      entries: this.entries,
      errors: this.errors
    };
  }
}
