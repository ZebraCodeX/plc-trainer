/** Classification helpers for ladder / instruction elements. */

export function isContact(op: string): boolean {
  return ['XIC', 'XIO', 'ONS'].includes(op.toUpperCase());
}

export function isCoil(op: string): boolean {
  return ['OTE', 'OTL', 'OTU'].includes(op.toUpperCase());
}
