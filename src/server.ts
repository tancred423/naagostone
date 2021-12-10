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
    if (parsed.Character.mainhand?.item_level)
      iLvls.push(parsed.Character.mainhand.item_level)
    if (parsed.Character.offhand?.item_level)
      iLvls.push(parsed.Character.offhand.item_level)
    if (parsed.Character.head?.item_level)
      iLvls.push(parsed.Character.head.item_level)
    if (parsed.Character.body?.item_level)
      iLvls.push(parsed.Character.body.item_level)
    if (parsed.Character.hands?.item_level)
      iLvls.push(parsed.Character.hands.item_level)
    if (parsed.Character.legs?.item_level)
      iLvls.push(parsed.Character.legs.item_level)
    if (parsed.Character.feet?.item_level)
      iLvls.push(parsed.Character.feet.item_level)
    if (parsed.Character.earrings?.item_level)
      iLvls.push(parsed.Character.earrings.item_level)
    if (parsed.Character.necklace?.item_level)
      iLvls.push(parsed.Character.necklace.item_level)
    if (parsed.Character.bracelets?.item_level)
      iLvls.push(parsed.Character.bracelets.item_level)
    if (parsed.Character.ring1?.item_level)
      iLvls.push(parsed.Character.ring1.item_level)
    if (parsed.Character.ring2?.item_level)
      iLvls.push(parsed.Character.ring2.item_level)

    parsed.Character.item_level = Math.ceil(
      iLvls.reduce((a, b) => a + b) / iLvls.length
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
