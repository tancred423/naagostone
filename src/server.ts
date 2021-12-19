import express from 'express'
import { Topics } from './profile/topics'
import { Maintenance } from './profile/maintenance'
import { Character } from './profile/character'
import { ItemLevel } from './profile/itemLevel'
import { CharacterSearch } from './search/character-search'
import { MaintenanceDetails } from './profile/maintenanceDetails'

const app = express()

const characterParser = new Character()
const characterSearch = new CharacterSearch()
const topicsParser = new Topics()
const maintenanceParser = new Maintenance()
const maintenanceDetailsParser = new MaintenanceDetails()

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

    parsed.Character.item_level = ItemLevel.getAverageItemLevel(parsed)

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

app.get('/lodestone/maintenance', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  if ((req.query['columns'] as string)?.indexOf('Bio') > -1) {
    res.set('Cache-Control', 'max-age=3600')
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const maintenances = await maintenanceParser.parse(req)
    const parsed: any = {
      Maintenances: {
        ...maintenances
      }
    }

    for (var key in parsed.Maintenances)
      if (parsed.Maintenances[key].link)
        parsed.Maintenances[key].link =
          'https://eu.finalfantasyxiv.com' + parsed.Maintenances[key].link

    const resArray = []
    for (var key in parsed.Maintenances) resArray.push(parsed.Maintenances[key])

    parsed.Maintenances = resArray

    for (const key in parsed.Maintenances) {
      const details = await maintenanceDetailsParser.parse(
        req,
        '',
        parsed.Maintenances[key].link
      )

      parsed.Maintenances[key].details = details
    }

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

app.get('/lodestone/topics', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  if ((req.query['columns'] as string)?.indexOf('Bio') > -1) {
    res.set('Cache-Control', 'max-age=3600')
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const topics = await topicsParser.parse(req)
    const parsed: any = {
      Topics: {
        ...topics
      }
    }

    for (var key in parsed.Topics)
      if (parsed.Topics[key].link)
        parsed.Topics[key].link =
          'https://eu.finalfantasyxiv.com' + parsed.Topics[key].link

    const resArray = []
    for (var key in parsed.Topics) resArray.push(parsed.Topics[key])

    parsed.Topics = resArray

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

const port = 8081
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
server.on('error', console.error)
