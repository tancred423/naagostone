function addLeadingZeros(num: number, length: number) {
  const numString = num.toString()
  if (numString.length >= length) return numString
  else return '0'.repeat(length - numString.length) + numString
}

export class ItemLevel {
  static getAverageItemLevel(parsed: any): any {
    let iLvls = []

    if (parsed.Character.mainhand?.item_level) {
      iLvls.push(parsed.Character.mainhand.item_level)
      parsed.Character.mainhand.item_level = addLeadingZeros(
        parsed.Character.mainhand.item_level,
        3
      )
    }

    if (parsed.Character.offhand?.item_level) {
      iLvls.push(parsed.Character.offhand.item_level)
      parsed.Character.offhand.item_level = addLeadingZeros(
        parsed.Character.offhand.item_level,
        3
      )
    }

    if (parsed.Character.head?.item_level) {
      iLvls.push(parsed.Character.head.item_level)
      parsed.Character.head.item_level = addLeadingZeros(
        parsed.Character.head.item_level,
        3
      )
    }

    if (parsed.Character.body?.item_level) {
      iLvls.push(parsed.Character.body.item_level)
      parsed.Character.body.item_level = addLeadingZeros(
        parsed.Character.body.item_level,
        3
      )
    }

    if (parsed.Character.hands?.item_level) {
      iLvls.push(parsed.Character.hands.item_level)
      parsed.Character.hands.item_level = addLeadingZeros(
        parsed.Character.hands.item_level,
        3
      )
    }

    if (parsed.Character.legs?.item_level) {
      iLvls.push(parsed.Character.legs.item_level)
      parsed.Character.legs.item_level = addLeadingZeros(
        parsed.Character.legs.item_level,
        3
      )
    }

    if (parsed.Character.feet?.item_level) {
      iLvls.push(parsed.Character.feet.item_level)
      parsed.Character.feet.item_level = addLeadingZeros(
        parsed.Character.feet.item_level,
        3
      )
    }

    if (parsed.Character.earrings?.item_level) {
      iLvls.push(parsed.Character.earrings.item_level)
      parsed.Character.earrings.item_level = addLeadingZeros(
        parsed.Character.earrings.item_level,
        3
      )
    }

    if (parsed.Character.necklace?.item_level) {
      iLvls.push(parsed.Character.necklace.item_level)
      parsed.Character.necklace.item_level = addLeadingZeros(
        parsed.Character.necklace.item_level,
        3
      )
    }

    if (parsed.Character.bracelets?.item_level) {
      iLvls.push(parsed.Character.bracelets.item_level)
      parsed.Character.bracelets.item_level = addLeadingZeros(
        parsed.Character.bracelets.item_level,
        3
      )
    }

    if (parsed.Character.ring1?.item_level) {
      iLvls.push(parsed.Character.ring1.item_level)
      parsed.Character.ring1.item_level = addLeadingZeros(
        parsed.Character.ring1.item_level,
        3
      )
    }

    if (parsed.Character.ring2?.item_level) {
      iLvls.push(parsed.Character.ring2.item_level)
      parsed.Character.ring2.item_level = addLeadingZeros(
        parsed.Character.ring2.item_level,
        3
      )
    }

    return addLeadingZeros(
      Math.ceil(iLvls.reduce((a, b) => a + b) / iLvls.length),
      3
    )
  }
}
