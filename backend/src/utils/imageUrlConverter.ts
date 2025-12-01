/**
 * Converts ArtStation thumbnail URLs to high-quality image URLs
 * 
 * Pattern:
 * Thumbnail: https://cdna.artstation.com/p/assets/images/images/033/922/466/20210118042009/smaller_square/tomasz-ryger-beorn.jpg?1610965210
 * High quality: https://cdna.artstation.com/p/assets/images/images/033/922/466/large/tomasz-ryger-beorn.jpg?1610965210
 * 
 * The conversion removes the timestamp segment and replaces size indicators with "large"
 */

/**
 * Converts a thumbnail URL to a high-quality image URL
 * @param thumbnailUrl - The thumbnail URL from ArtStation
 * @returns The high-quality image URL, or the original URL if conversion fails
 */
export function convertToHighQualityUrl(thumbnailUrl: string): string {
  if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
    return thumbnailUrl;
  }

  try {
    // Pattern: Remove timestamp segment (YYYYMMDDHHMMSS) and replace size indicators with "large"
    // Size indicators can be: smaller_square, small, medium, thumb, etc.
    
    // Match the pattern: /timestamp/size_indicator/filename
    // Replace with: /large/filename
    
    // First, try to match the common pattern with timestamp
    const timestampPattern = /\/(\d{14})\/(smaller_square|small|medium|thumb|thumbnail|square)\//;
    if (timestampPattern.test(thumbnailUrl)) {
      return thumbnailUrl.replace(timestampPattern, '/large/');
    }
    
    // Try pattern without timestamp: /size_indicator/filename
    const sizePattern = /\/(smaller_square|small|medium|thumb|thumbnail|square)\//;
    if (sizePattern.test(thumbnailUrl)) {
      return thumbnailUrl.replace(sizePattern, '/large/');
    }
    
    // If no pattern matches, return original URL
    return thumbnailUrl;
  } catch (error) {
    console.error('Error converting thumbnail URL to high quality:', error);
    return thumbnailUrl;
  }
}

