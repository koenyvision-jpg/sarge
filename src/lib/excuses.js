export const EXCUSES = [
  ['tired', 'Too tired'],
  ['no-time', 'No time'],
  ['sick', 'Sick'],
  ['injured', 'Injured / pain'],
  ['travel', 'Travelling'],
  ['skipped', 'Just skipped it'],
  ['other', 'Other'],
]

export const excuseLabel = e => [EXCUSES.find(x => x[0] === e?.category)?.[1] || e?.category, e?.text].filter(Boolean).join(' — ')
