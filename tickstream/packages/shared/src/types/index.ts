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
  /** Why encoding failed. Only set on a failed video, which only its creator and admins can list. */
  error?: string | null
  creator: { address: string; username: string; displayName: string | null; avatarVersion: number | null }
}

export interface UserProfile {
  address: string
  username: string
  displayName: string | null
  bio: string | null
  /** Changes whenever the profile picture changes. Null when there is none. */
  avatarVersion: number | null
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
  /** 'watch' for pay-per-second payments, 'tip' for tips. */
  kind: 'watch' | 'tip'
  /** Note the viewer attached to a tip. */
  message: string | null
}

export interface CommentItem {
  id: string
  body: string
  createdAt: string
  author: { address: string; username: string; displayName: string | null; avatarVersion: number | null }
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
  avatarVersion: number | null
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
}


/** Studio numbers for one period, all from real payments and viewing sessions. Days are UTC. */
export interface StudioTotals {
  watchMicro: number
  tipsMicro: number
  /** Seconds of video viewers paid for. */
  paidSeconds: number
  /** Sessions started, including ones that only used a free preview. */
  starts: number
  paidSessions: number
  payingViewers: number
}

export interface StudioDay {
  day: string
  watchMicro: number
  tipsMicro: number
  paidSeconds: number
  starts: number
  paidSessions: number
  payingViewers: number
}

export interface StudioVideoStats {
  videoId: string
  title: string
  status: VideoStatus
  priceMicro: number
  durationSeconds: number | null
  createdAt: string
  lifetimeViews: number
  starts: number
  payingViewers: number
  watchMicro: number
  tipsMicro: number
  paidSeconds: number
  /** Average share of the video each paid session paid for, 0 to 100. */
  avgCompletionPercent: number
  /** Paid sessions by share of the video paid: under 25, 25 to 50, 50 to 75, 75 or more. */
  completion: [number, number, number, number]
}

export interface StudioSupporter {
  payer: string
  totalMicro: number
  payments: number
  tipsMicro: number
}

export interface StudioStats {
  days: number
  /** First and last day of the period, as YYYY-MM-DD. */
  from: string
  to: string
  /** The period before, of the same length, as YYYY-MM-DD. The totals in `previous` cover these days. */
  previousFrom: string
  previousTo: string
  series: StudioDay[]
  current: StudioTotals
  previous: StudioTotals
  /** Paying viewers who paid in more than one session this period. */
  returningViewers: number
  videos: StudioVideoStats[]
  supporters: StudioSupporter[]
  /** Money in the period by where it is in settlement. */
  settlement: { pendingMicro: number; settledMicro: number }
}
