import { BskyAgent } from "@atproto/api";

export interface BlueskyStats {
  posts: number;
  replies: number;
  likes: number;
  loading: boolean;
  progress: number; // 0-100
  error?: string;
  mostActiveMonth?: string;
  firstPostDate?: string;
}

export const agent = new BskyAgent({
  service: "https://bsky.social",
});

export async function fetchYearlyStats(
  handleOrDid: string, 
  year: number, 
  onProgress: (progress: number) => void
): Promise<Omit<BlueskyStats, "loading" | "progress" | "error">> {
  
  // Resolve handle to DID if needed
  let did = handleOrDid;
  if (!did.startsWith("did:")) {
    const res = await agent.resolveHandle({ handle: handleOrDid });
    did = res.data.did;
  }

  const startOfYear = new Date(`${year}-01-01T00:00:00Z`).getTime();
  const endOfYear = new Date(`${year + 1}-01-01T00:00:00Z`).getTime();

  let posts = 0;
  let replies = 0;
  let likes = 0;
  
  // We'll track month counts to find most active month
  const monthCounts: Record<number, number> = {};

  // Helper to fetch all records of a collection
  const fetchCollection = async (collection: string, processRecord: (record: any) => void) => {
    let cursor: string | undefined;
    let keepGoing = true;
    
    while (keepGoing) {
      const res = await agent.api.com.atproto.repo.listRecords({
        repo: did,
        collection,
        limit: 100,
        cursor,
      });

      for (const recordObj of res.data.records) {
        const record = recordObj.value as any;
        const createdAt = new Date(record.createdAt).getTime();

        if (createdAt >= startOfYear && createdAt < endOfYear) {
          processRecord(record);
        } else if (createdAt < startOfYear) {
          // Assuming records are roughly ordered (they aren't always guaranteed by listRecords, but often are)
          // Actually, listRecords is by RKEY. RKEYs are often time-based (TID), so we can stop if we go too far back?
          // No, RKEYs are not strictly guaranteed to be time-ordered in all implementations, but for Bluesky they usually are (TID).
          // We'll assume we need to scan everything to be safe or until we hit a clear boundary if we trust TIDs.
          // For safety in this prototype, we'll scan until we see enough old records or finish.
          // Optimization: If we see 50 records in a row older than startOfYear, we abort.
        }
      }
      
      cursor = res.data.cursor;
      if (!cursor) keepGoing = false;
      
      // Fake progress for UI feedback
      onProgress(Math.random() * 10); // Incrementally add progress
    }
  };

  // Fetch Posts (includes replies)
  let consecutiveOldPosts = 0;
  let cursor: string | undefined;
  let hasMore = true;
  
  // Optimization: Fetching posts/replies
  // We can't easily parallelize listRecords for a single collection without known cursors.
  // We will do it sequentially.
  
  while (hasMore) {
    const res = await agent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: "app.bsky.feed.post",
      limit: 100,
      cursor,
    });

    if (res.data.records.length === 0) break;

    for (const { value } of res.data.records) {
      const record = value as any;
      const date = new Date(record.createdAt);
      const time = date.getTime();

      if (time > endOfYear) continue;
      
      if (time < startOfYear) {
        consecutiveOldPosts++;
        if (consecutiveOldPosts > 50) {
          hasMore = false;
          break;
        }
        continue;
      }
      consecutiveOldPosts = 0;

      // It's in 2025
      if (record.reply) {
        replies++;
      } else {
        posts++;
      }
      
      const month = date.getMonth();
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    }
    
    cursor = res.data.cursor;
    if (!cursor) break;
    onProgress(5); // Arbitrary progress tick
  }

  // Reset for Likes
  cursor = undefined;
  hasMore = true;
  consecutiveOldPosts = 0;

  while (hasMore) {
    const res = await agent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: "app.bsky.feed.like",
      limit: 100,
      cursor,
    });

    if (res.data.records.length === 0) break;

    for (const { value } of res.data.records) {
      const record = value as any;
      const time = new Date(record.createdAt).getTime();

      if (time > endOfYear) continue;
      if (time < startOfYear) {
        consecutiveOldPosts++;
        if (consecutiveOldPosts > 50) {
          hasMore = false;
          break;
        }
        continue;
      }
      consecutiveOldPosts = 0;
      likes++;
    }
    
    cursor = res.data.cursor;
    if (!cursor) break;
    onProgress(5);
  }

  // Calculate most active month
  let maxMonth = 0;
  let maxCount = 0;
  Object.entries(monthCounts).forEach(([m, c]) => {
    if (c > maxCount) {
      maxCount = c;
      maxMonth = parseInt(m);
    }
  });
  
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return {
    posts,
    replies,
    likes,
    mostActiveMonth: maxCount > 0 ? months[maxMonth] : undefined
  };
}
