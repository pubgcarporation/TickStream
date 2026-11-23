export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'removed'

export interface SegmentInfo {
  name: string
  duration: number
}

export interface VideoSummary {
  id: string
  title: string
  description: string
  category: string
  priceMicro: number
  /** Seconds at the start of the video that anyone can watch without paying. */
  previewSeconds: number
  durationSeconds: number | null
  status: VideoStatus
  views: number
  createdAt: string
  creator: { address: string; username: string; displayName: string | null }
}

export interface UserProfile {
  address: string
  username: string
  displayName: string | null
  bio: string | null
  createdAt: string
}

export interface SessionInfo {
  id: string
  videoId: string
  chunkSeconds: number
  capMicro: number
  spentMicro: number
  authorizedSeconds: number
  startSecond: number
  authorizedEndSecond: number
  durationSeconds: number
  segmentSeconds: number
  priceMicro: number
  complete: boolean
  playlistUrl: string
}

export interface GrantResult {
  session: SessionInfo
  amountMicro: number
  transferId: string | null
  network: string
}

export interface EarningsSummary {
  totalMicro: number
  last24hMicro: number
  secondsSold: number
  pendingMicro: number
  settledMicro: number
  perVideo: Array<{ videoId: string; title: string; earnedMicro: number; secondsSold: number; views: number }>
  daily: Array<{ day: string; earnedMicro: number; secondsSold: number }>
}

export interface PaymentRecord {
  id: string
  videoId: string
  videoTitle: string
  payer: string
  amountMicro: number
  seconds: number
  status: 'pending' | 'settled' | 'failed'
  transferId: string | null
  createdAt: string
}

export interface CommentItem {
  id: string
  body: string
  createdAt: string
  author: { address: string; username: string; displayName: string | null }
  canRemove: boolean
}

export interface FollowState {
  following: boolean
  followers: number
}

export interface CreatorSummary {
  address: string
  username: string
  displayName: string | null
  videos: number
  followers: number
}

export interface VideoAnalytics {
  videoId: string
  title: string
  views: number
  sessions: number
  viewers: number
  avgWatchSeconds: number
  avgCompletionPercent: number
  earnedMicro: number
  /** Share of sessions that paid for 0-25, 25-50, 50-75 and 75-100 percent of the video. */
  completion: [number, number, number, number]
}

export interface CreatorAnalytics {
  videos: VideoAnalytics[]
  dailyViewers: Array<{ day: string; viewers: number }>
}

export interface AdminOverview {
  users: number
  videos: number
  removedVideos: number
  sessions24h: number
  volumeTotalMicro: number
  volume24hMicro: number
  openReports: number
}

export interface ReportItem {
  id: string
  reason: string
  details: string
  status: 'open' | 'resolved'
  resolution: string | null
  createdAt: string
  reporter: string
  target:
    | { kind: 'video'; id: string; title: string; creator: string; status: VideoStatus }
    | { kind: 'comment'; id: string; body: string; author: string; videoId: string }
}
