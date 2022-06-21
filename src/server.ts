import express from 'express'
import { Character } from './profile/character'
import { ItemLevel } from './profile/itemLevel'
import { CharacterSearch } from './search/character-search'

import { Topics } from './profile/topics'

import { Notices } from './profile/notices'
import { NoticesDetails } from './profile/noticesDetails'

import { Maintenances } from './profile/maintenances'
import { MaintenancesDetails } from './profile/maintenancesDetails'

import { Updates } from './profile/updates'
import { UpdatesDetails } from './profile/updatesDetails'

import { Status } from './profile/status'
import { StatusDetails } from './profile/statusDetails'

const app = express()

const characterParser = new Character()
const characterSearch = new CharacterSearch()
const topicsParser = new Topics()
const noticesParser = new Notices()
const noticesDetailsParser = new NoticesDetails()
const maintenanceParser = new Maintenances()
const maintenanceDetailsParser = new MaintenancesDetails()
const updatesParser = new Updates()
const updatesDetailsParser = new UpdatesDetails()
const statusParser = new Status()
const statusDetailsParser = new StatusDetails()

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
        ...character,
      },
    }

    parsed.Character.item_level = ItemLevel.getAverageItemLevel(parsed)

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

app.get('/lodestone/topics', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Cache-Control', 'max-age=0')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const topics = await topicsParser.parse(req)
    const parsed: any = {
      Topics: {
        ...topics,
      },
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

app.get('/lodestone/notices', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Cache-Control', 'max-age=0')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const notices = await noticesParser.parse(req)
    const noticesFiltered = Object.fromEntries(
      Object.entries(notices).filter(([_, v]) => v !== null)
    )

    const parsed: any = {
      Notices: {
        ...noticesFiltered,
      },
    }

    for (var key in parsed.Notices)
      if (parsed.Notices[key].link)
        parsed.Notices[key].link =
          'https://eu.finalfantasyxiv.com' + parsed.Notices[key].link

    const resArray = []
    for (var key in parsed.Notices) resArray.push(parsed.Notices[key])

    parsed.Notices = resArray

    for (const key in parsed.Notices) {
      const details = await noticesDetailsParser.parse(
        req,
        '',
        parsed.Notices[key].link
      )

      parsed.Notices[key].details = details
    }

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

app.get('/lodestone/maintenance', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Cache-Control', 'max-age=0')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const maintenances = await maintenanceParser.parse(req)
    const parsed: any = {
      Maintenances: {
        ...maintenances,
      },
    }

    for (var key in parsed.Maintenances)
      if (parsed.Maintenances[key]?.link)
        parsed.Maintenances[key].link =
          'https://eu.finalfantasyxiv.com' + parsed.Maintenances[key].link

    const resArray = []
    for (var key in parsed.Maintenances)
      if (parsed.Maintenances[key]) resArray.push(parsed.Maintenances[key])

    parsed.Maintenances = resArray

    for (const key in parsed.Maintenances) {
      const details = await maintenanceDetailsParser.parse(
        req,
        '',
        parsed.Maintenances[key]?.link
      )

      if (parsed.Maintenances[key]) parsed.Maintenances[key].details = details
    }

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

app.get('/lodestone/updates', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Cache-Control', 'max-age=0')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const updates = await updatesParser.parse(req)
    const parsed: any = {
      Updates: {
        ...updates,
      },
    }

    for (var key in parsed.Updates)
      if (parsed.Updates[key].link)
        parsed.Updates[key].link =
          'https://eu.finalfantasyxiv.com' + parsed.Updates[key].link

    const resArray = []
    for (var key in parsed.Updates) resArray.push(parsed.Updates[key])

    parsed.Updates = resArray

    for (const key in parsed.Updates) {
      const details = await updatesDetailsParser.parse(
        req,
        '',
        parsed.Updates[key].link
      )

      parsed.Updates[key].details = details
    }

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

app.get('/lodestone/status', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Cache-Control', 'max-age=0')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  try {
    const status = await statusParser.parse(req)
    const parsed: any = {
      Status: {
        ...status,
      },
    }

    for (var key in parsed.Status)
      if (parsed.Status[key].link)
        parsed.Status[key].link =
          'https://eu.finalfantasyxiv.com' + parsed.Status[key].link

    const resArray = []
    for (var key in parsed.Status) resArray.push(parsed.Status[key])

    parsed.Status = resArray

    for (const key in parsed.Status) {
      const details = await statusDetailsParser.parse(
        req,
        '',
        parsed.Status[key].link
      )

      parsed.Status[key].details = details
    }

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

const port = 3001
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
server.on('error', console.error)
