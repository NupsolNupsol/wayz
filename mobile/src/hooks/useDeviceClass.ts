import { useWindowDimensions } from 'react-native'

export type DeviceClass = 'handheld' | 'tablet' | 'desk'

const TABLET_MIN = 600
const DESK_MIN = 1100

export function useDeviceClass() {
  const { width, height } = useWindowDimensions()
  const shortest = Math.min(width, height)
  const deviceClass: DeviceClass = width >= DESK_MIN ? 'desk' : shortest >= TABLET_MIN ? 'tablet' : 'handheld'

  const isTablet = deviceClass !== 'handheld'

  return {
    deviceClass,
    isTablet,
    isDesk: deviceClass === 'desk',
    width,
    height,
    navPosition: isTablet ? ('left' as const) : ('bottom' as const),
    splitView: width >= DESK_MIN,
    columns: width >= DESK_MIN ? 4 : shortest >= TABLET_MIN ? 3 : 2,
    contentMaxWidth: width >= DESK_MIN ? 1120 : undefined,
  }
}
