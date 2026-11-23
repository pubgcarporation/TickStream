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
