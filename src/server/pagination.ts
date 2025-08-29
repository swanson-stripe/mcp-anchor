/**
 * Cursor-based pagination utilities
 */

export interface PaginationCursor {
  offset: number;
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    count: number;
  };
}

/**
 * Encode pagination cursor to base64
 */
export function encodeCursor(cursor: PaginationCursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode pagination cursor from base64
 */
export function decodeCursor(cursorString: string): PaginationCursor {
  try {
    const json = Buffer.from(cursorString, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    
    // Validate the cursor structure
    if (typeof parsed.offset !== 'number' || parsed.offset < 0) {
      throw new Error('Invalid cursor format');
    }
    
    return parsed as PaginationCursor;
  } catch (error) {
    throw new Error(`Invalid cursor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create paginated result from data array
 */
export function createPaginatedResult<T>(
  allData: T[],
  params: PaginationParams = {}
): PaginationResult<T> {
  const { limit = 50, cursor } = params;
  
  // Decode cursor to get offset
  let offset = 0;
  if (cursor) {
    try {
      const decodedCursor = decodeCursor(cursor);
      offset = decodedCursor.offset;
    } catch (error) {
      // Invalid cursor, start from beginning
      console.warn('Invalid cursor provided, starting from beginning:', error);
      offset = 0;
    }
  }
  
  // Slice the data for this page
  const startIndex = offset;
  const endIndex = startIndex + limit;
  const pageData = allData.slice(startIndex, endIndex);
  
  // Determine if there's more data
  const hasMore = endIndex < allData.length;
  
  // Create next cursor if there's more data
  let nextCursor: string | undefined;
  if (hasMore) {
    nextCursor = encodeCursor({ offset: endIndex });
  }
  
  return {
    data: pageData,
    pagination: {
      hasMore,
      nextCursor,
      count: pageData.length
    }
  };
}

/**
 * Parse pagination parameters from query string
 */
export function parsePaginationParams(query: Record<string, any>): PaginationParams {
  const params: PaginationParams = {};
  
  // Parse limit
  if (query.limit) {
    const limit = parseInt(query.limit, 10);
    if (!isNaN(limit) && limit > 0 && limit <= 1000) {
      params.limit = limit;
    }
  }
  
  // Parse cursor
  if (query.cursor && typeof query.cursor === 'string') {
    params.cursor = query.cursor;
  }
  
  return params;
}

/**
 * Parse date range parameters from query string
 */
export function parseDateRangeParams(query: Record<string, any>): {
  from?: number;
  to?: number;
} {
  const params: { from?: number; to?: number } = {};
  
  // Parse 'from' date
  if (query.from && typeof query.from === 'string') {
    const fromDate = new Date(query.from);
    if (!isNaN(fromDate.getTime())) {
      params.from = fromDate.getTime();
    }
  }
  
  // Parse 'to' date
  if (query.to && typeof query.to === 'string') {
    const toDate = new Date(query.to);
    if (!isNaN(toDate.getTime())) {
      params.to = toDate.getTime();
    }
  }
  
  return params;
}
