import { RequireAuth } from '@/components/creator/RequireAuth'
import { StudioNav } from '@/components/creator/StudioNav'
import { StudioAnalytics } from './studio/StudioAnalytics'
import { StudioEarnings } from './studio/StudioEarnings'
import { StudioOverview } from './studio/StudioOverview'
import { StudioSettings } from './studio/StudioSettings'
import { StudioUpload } from './studio/StudioUpload'
import { StudioVideos } from './studio/StudioVideos'

export function StudioPage({ section }: { section: string }) {
  return (
    <div className="space-y-4">
      <StudioNav />
      <RequireAuth title="Sign in to open your studio" body="Sign in to continue. Payments from viewers go straight to that wallet's address.">
        {section === 'videos' && <StudioVideos />}
        {section === 'upload' && <StudioUpload />}
        {section === 'analytics' && <StudioAnalytics />}
        {section === 'earnings' && <StudioEarnings />}
        {section === 'settings' && <StudioSettings />}
        {section === '' && <StudioOverview />}
      </RequireAuth>
    </div>
  )
}
