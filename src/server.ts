import express from 'express'
import { Character } from './profile/character'
import { Achievements } from './profile/achievements'
import { CharacterSearch } from './search/character-search'
import { isObject } from 'lodash'

const app = express()

const characterParser = new Character()
const achievementsParser = new Achievements()
const characterSearch = new CharacterSearch()

app.get('/character/search', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const parsed = await characterSearch.parse(req)
    return res.status(200).send(parsed)
  } catch (err: any) {
    return res.status(500).send(err)
  }
})

function addLeadingZeros(num: number, length: number) {
  const numString = num.toString()
  if (numString.length >= length) return numString
  else return '0'.repeat(length - numString.length) + numString
}

app.get('/character/:characterId', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  if ((req.query['columns'] as string)?.indexOf('Bio') > -1) {
    res.set('Cache-Control', 'max-age=3600')
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const character = await characterParser.parse(req, 'Character.')
    const parsed: any = {
      Character: {
        ID: +req.params.characterId,
        ...character
      }
    }

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

    parsed.Character.item_level = addLeadingZeros(
      Math.ceil(iLvls.reduce((a, b) => a + b) / iLvls.length),
      3
    )

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

const port = process.env.PORT || 8080
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
server.on('error', console.error)
