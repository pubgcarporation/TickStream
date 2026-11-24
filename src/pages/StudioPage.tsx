import { RequireAuth } from '@/components/creator/RequireAuth'
import { StudioNav } from '@/components/creator/StudioNav'
import { EmptyState } from '@/components/ui/primitives'
import { StudioAnalytics } from './studio/StudioAnalytics'
import { StudioEarnings } from './studio/StudioEarnings'
import { StudioOverview } from './studio/StudioOverview'
import { StudioSettings } from './studio/StudioSettings'
import { StudioUpload } from './studio/StudioUpload'
import { StudioVideos } from './studio/StudioVideos'

const SECTIONS = ['', 'videos', 'upload', 'analytics', 'earnings', 'settings']

export function StudioPage({ section }: { section: string }) {
  return (
    <div className="space-y-2.5">
      <StudioNav />
      <RequireAuth title="Sign in to open your studio" body="Sign in to continue. Payments from viewers go straight to that wallet's address.">
        {section === 'videos' && <StudioVideos />}
        {section === 'upload' && <StudioUpload />}
        {section === 'analytics' && <StudioAnalytics />}
        {section === 'earnings' && <StudioEarnings />}
        {section === 'settings' && <StudioSettings />}
        {section === '' && <StudioOverview />}
        {!SECTIONS.includes(section) && <EmptyState title="That Studio page does not exist" body="Pick one of the sections above." />}
      </RequireAuth>
    </div>
  )
}
