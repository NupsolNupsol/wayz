import { useWindowDimensions } from 'react-native'

export type DeviceClass = 'handheld' | 'tablet' | 'desk'

/** A Sunmi V2s is ~360dp wide; a V3 MIX is ~800dp; a 1280px counter tablet is wider still. */
const TABLET_MIN = 600
const DESK_MIN = 1100

/**
 * Which form factor this is running on, and the handful of layout decisions that follow from
 * it. Screens read these instead of guessing from the platform, because every device is Android
 * and the difference that matters is width, not OS.
 */
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
    /** Navigation sits under the thumb on a handheld and beside the content on anything wider. */
    navPosition: isTablet ? ('left' as const) : ('bottom' as const),
    /** A list and its detail can share the screen once there is room for both. */
    splitView: width >= DESK_MIN,
    /** Cards per row for the tile grids. */
    columns: width >= DESK_MIN ? 4 : shortest >= TABLET_MIN ? 3 : 2,
    /** Long-form content stops growing; a 1280px line of text is unreadable. */
    contentMaxWidth: width >= DESK_MIN ? 1120 : undefined,
  }
}
