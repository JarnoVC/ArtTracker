/**
 * Request deduplication utility
 * Prevents duplicate API calls for the same operation
 */

type RequestKey = string;
type PendingRequest<T> = Promise<T>;

const pendingRequests = new Map<RequestKey, PendingRequest<any>>();

/**
 * Deduplicates a request by key
 * If a request with the same key is already in flight, returns the existing promise
 * Otherwise, executes the request function and caches the promise
 * 
 * @param key - Unique identifier for this request (e.g., 'loadArtists', 'loadArtworks:123:false')
 * @param requestFn - Function that returns a promise for the actual request
 * @returns Promise that resolves/rejects with the request result
 */
export function deduplicateRequest<T>(
  key: RequestKey,
  requestFn: () => Promise<T>
): Promise<T> {
  // If there's already a pending request with this key, return it
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Create new request and cache it
  const promise = requestFn()
    .then((result) => {
      // Remove from cache on success
      pendingRequests.delete(key);
      return result;
    })
    .catch((error) => {
      // Remove from cache on error
      pendingRequests.delete(key);
      throw error;
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Clears all pending requests (useful for cleanup or testing)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Gets the number of currently pending requests
 */
export function getPendingRequestCount(): number {
  return pendingRequests.size;
}

