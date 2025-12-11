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
  onProgress: (progress: number) => void,
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

  // listRecords で取得したレコード件数の累積。
  // ローディング画面のプログレス表示用に使う。
  let totalFetchedRecords = 0;

  // Helper to fetch all records of a collection (kept for future use)
  const fetchCollection = async (
    collection: string,
    processRecord: (record: any) => void,
  ) => {
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
          // see original comments; we currently keep scanning
        }
      }

      cursor = res.data.cursor;
      if (!cursor) keepGoing = false;

      // 現状このヘルパーは使っていないが、
      // 将来的に利用する場合はここでも totalFetchedRecords を更新して
      // onProgress(totalFetchedRecords) を呼び出す想定。
    }
  };

  // Fetch Posts (includes replies)
  let consecutiveOldPosts = 0;
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const res = await agent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: "app.bsky.feed.post",
      limit: 100,
      cursor,
    });

    if (res.data.records.length === 0) break;

    // listRecords で取得した件数（最大 100 件）を累積
    totalFetchedRecords += res.data.records.length;

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

      // It's in target year
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

    // ここまでに取得した listRecords 件数の累積を進捗コールバックへ渡す
    onProgress(totalFetchedRecords);
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

    // Like コレクション側も同様に取得件数を累積
    totalFetchedRecords += res.data.records.length;

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

    onProgress(totalFetchedRecords);
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

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const mostActiveMonthName = maxCount > 0 ? months[maxMonth] : undefined;

  return {
    posts,
    replies,
    likes,
    mostActiveMonth: mostActiveMonthName,
  };
}

// すでに PDS に保存されている Year Summary レコード
// （net.shino3.yearsummary2025.wrap/2025）を読み出す軽量 API。
// /:handle アクセス時はこちらを優先して使う想定。
export async function fetchSavedSummary(
  handleOrDid: string,
): Promise<Omit<BlueskyStats, "loading" | "progress" | "error">> {
  // Resolve handle to DID if needed
  let did = handleOrDid;
  if (!did.startsWith("did:")) {
    const res = await agent.resolveHandle({ handle: handleOrDid });
    did = res.data.did;
  }

  const res = await agent.api.com.atproto.repo.getRecord({
    repo: did,
    collection: "net.shino3.yearsummary2025.wrap",
    rkey: "2025",
  });

  const record: any = res.data.value;

  return {
    posts: record.posts ?? 0,
    replies: record.replies ?? 0,
    likes: record.likes ?? 0,
    mostActiveMonth: record.mostActiveMonth ?? undefined,
  };
}
