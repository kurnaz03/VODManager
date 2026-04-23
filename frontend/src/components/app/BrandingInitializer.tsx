import { useEffect } from 'react'
import { useBrandingStore } from '../../store/brandingStore'

export default function BrandingInitializer() {
  const loadTheme = useBrandingStore((state) => state.loadTheme)

  useEffect(() => {
    void loadTheme()
  }, [loadTheme])

  return null
}