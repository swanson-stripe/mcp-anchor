/**
 * JSCodeshift transformer for creating fetch boundary abstraction (CommonJS version)
 * Replaces direct fetch calls with apiClient.fetch calls
 */
const transform = (fileInfo, api, options) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  let hasChanges = false;
  let apiClientImportAdded = false;

  // Find all fetch call expressions
  const fetchCalls = root.find(j.CallExpression, {
    callee: { name: 'fetch' }
  });

  // Skip if no fetch calls found
  if (fetchCalls.length === 0) {
    return fileInfo.source;
  }

  // Check if apiClient is already imported
  const existingImports = root.find(j.ImportDeclaration);
  let hasApiClientImport = false;
  
  existingImports.forEach(path => {
    const source = path.value.source;
    if (source && typeof source.value === 'string' && 
        (source.value.includes('apiClient') || source.value.includes('./api-client'))) {
      hasApiClientImport = true;
    }
  });

  // Transform fetch calls to apiClient.fetch
  fetchCalls.forEach(path => {
    const callExpr = path.value;
    
    // Skip if already using apiClient or similar patterns
    if (callExpr.callee.type === 'MemberExpression') {
      const object = callExpr.callee.object;
      if (object.type === 'Identifier' && 
          (object.name === 'apiClient' || 
           object.name === 'client' || 
           object.name === 'http')) {
        return; // Skip already abstracted calls
      }
    }

    // Replace fetch(...) with apiClient.fetch(...)
    const newCall = j.callExpression(
      j.memberExpression(
        j.identifier('apiClient'),
        j.identifier('fetch')
      ),
      callExpr.arguments
    );

    j(path).replaceWith(newCall);
    hasChanges = true;
  });

  // Add apiClient import if we made changes and it's not already imported
  if (hasChanges && !hasApiClientImport) {
    // Create import statement
    const apiClientImport = j.importDeclaration(
      [j.importDefaultSpecifier(j.identifier('apiClient'))],
      j.literal('./api-client')
    );

    // Find the last import or add at the top
    const lastImport = root.find(j.ImportDeclaration).at(-1);
    
    if (lastImport.length > 0) {
      lastImport.insertAfter(apiClientImport);
    } else {
      // Add at the beginning of the file
      root.get().node.body.unshift(apiClientImport);
    }
    
    apiClientImportAdded = true;
  }

  // Log transformation if verbose
  if (hasChanges && options.verbose) {
    console.log(`✅ Transformed ${fetchCalls.length} fetch calls in ${fileInfo.path}`);
    if (apiClientImportAdded) {
      console.log(`   Added apiClient import`);
    }
  }

  return hasChanges ? root.toSource() : fileInfo.source;
};

// Export for CommonJS
module.exports = transform;
module.exports.default = transform;
