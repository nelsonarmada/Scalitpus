import logo from './assets/scalipus-logo.webp'
export default function BrandLogo({
  size = 34,
  full = false,
}: {
  size?: number
  full?: boolean
}) {
  return (
    <img
      src={logo}
      width={size}
      height={size}
      className={full ? 'brand-logo-full' : 'brand-logo'}
      alt={full ? 'Scalipus — Clube de Setúbal' : ''}
    />
  )
}
