import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '@shared/constants'
import { Chip } from '@/components/ui/primitives'

/** The topic strip under the header: All plus every category, scrollable with arrows when it overflows. */
export function CategoryChips({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const node = scroller.current
    if (!node) return
    setEdges({ left: node.scrollLeft > 4, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const scrollBy = (direction: 1 | -1) => scroller.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })

  return (
    <div className="sticky top-14 z-20 -mx-4 bg-[var(--bg)] px-4 py-3 sm:-mx-6 sm:px-6">
      <div className="relative">
        {edges.left && (
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll topics left"
            className="absolute left-0 top-0 z-10 flex h-9 w-12 items-center justify-start bg-gradient-to-r from-[var(--bg)] from-60% to-transparent"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        <div ref={scroller} onScroll={measure} className="flex gap-3 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Topics">
          <Chip active={value === ''} onClick={() => onChange('')}>
            All
          </Chip>
          {CATEGORIES.map((item) => (
            <Chip key={item.slug} active={value === item.slug} onClick={() => onChange(item.slug)}>
              {item.label}
            </Chip>
          ))}
        </div>
        {edges.right && (
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll topics right"
            className="absolute right-0 top-0 z-10 flex h-9 w-12 items-center justify-end bg-gradient-to-l from-[var(--bg)] from-60% to-transparent"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}
