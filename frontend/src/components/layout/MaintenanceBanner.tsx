import { useQuery } from '@tanstack/react-query'
import { backupsApi } from '../../modules/backups/services/backupsApi'

export default function MaintenanceBanner() {
  const { data } = useQuery({
    queryKey: ['backup-maintenance-status'],
    queryFn: backupsApi.getMaintenanceStatus,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  if (!data?.maintenance_mode) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white/80" />
      Sistem bakim modunda. Geri yukleme islemi devam ediyor&hellip;
    </div>
  )
}
