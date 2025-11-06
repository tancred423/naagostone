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
    let parsed: any = {
      Character: {
        ID: +req.params.characterId,
        ...character,
      },
    }

    parsed = fixNameColorIfOnlySecondDyeIsBeingUsed(parsed)
    parsed = countDyeSlots(parsed)
    parsed.Character.item_level = ItemLevel.getAverageItemLevel(parsed)

    return res.status(200).send(parsed)
  } catch (err: any) {
    if (err.message === '404') return res.sendStatus(404)
    else return res.status(500).send(err)
  }
})

function fixNameColorIfOnlySecondDyeIsBeingUsed(parsed: any) {
  if (!parsed.Character.mainhand?.color_code && parsed.Character.mainhand?.color_code2) {
    parsed.Character.mainhand.color_name2 = parsed.Character.mainhand.color_name
    delete parsed.Character.mainhand.color_name
  }

  if (!parsed.Character.offhand?.color_code && parsed.Character.offhand?.color_code2) {
    parsed.Character.offhand.color_name2 = parsed.Character.offhand.color_name
    delete parsed.Character.offhand.color_name
  }

  if (!parsed.Character.head?.color_code && parsed.Character.head?.color_code2) {
    parsed.Character.head.color_name2 = parsed.Character.head.color_name
    delete parsed.Character.head.color_name
  }

  if (!parsed.Character.body?.color_code && parsed.Character.body?.color_code2) {
    parsed.Character.body.color_name2 = parsed.Character.body.color_name
    delete parsed.Character.body.color_name
  }

  if (!parsed.Character.hands?.color_code && parsed.Character.hands?.color_code2) {
    parsed.Character.hands.color_name2 = parsed.Character.hands.color_name
    delete parsed.Character.hands.color_name
  }

  if (!parsed.Character.legs?.color_code && parsed.Character.legs?.color_code2) {
    parsed.Character.legs.color_name2 = parsed.Character.legs.color_name
    delete parsed.Character.legs.color_name
  }

  if (!parsed.Character.feet?.color_code && parsed.Character.feet?.color_code2) {
    parsed.Character.feet.color_name2 = parsed.Character.feet.color_name
    delete parsed.Character.feet.color_name
  }

  if (!parsed.Character.earrings?.color_code && parsed.Character.earrings?.color_code2) {
    parsed.Character.earrings.color_name2 = parsed.Character.earrings.color_name
    delete parsed.Character.earrings.color_name
  }

  if (!parsed.Character.necklace?.color_code && parsed.Character.necklace?.color_code2) {
    parsed.Character.necklace.color_name2 = parsed.Character.necklace.color_name
    delete parsed.Character.necklace.color_name
  }

  if (!parsed.Character.bracelets?.color_code && parsed.Character.bracelets?.color_code2) {
    parsed.Character.bracelets.color_name2 = parsed.Character.bracelets.color_name
    delete parsed.Character.bracelets.color_name
  }

  if (!parsed.Character.ring1?.color_code && parsed.Character.ring1?.color_code2) {
    parsed.Character.ring1.color_name2 = parsed.Character.ring1.color_name
    delete parsed.Character.ring1.color_name
  }

  if (!parsed.Character.ring2?.color_code && parsed.Character.ring2?.color_code2) {
    parsed.Character.ring2.color_name2 = parsed.Character.ring2.color_name
    delete parsed.Character.ring2.color_name
  }

  return parsed
}

function countDyeSlots(parsed: any) {
  if (parsed.Character.mainhand?.amount_dye_slots) {
    parsed.Character.mainhand.amount_dye_slots
      = (parsed.Character.mainhand.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.offhand?.amount_dye_slots) {
    parsed.Character.offhand.amount_dye_slots
      = (parsed.Character.offhand.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.head?.amount_dye_slots) {
    parsed.Character.head.amount_dye_slots
      = (parsed.Character.head.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.body?.amount_dye_slots) {
    parsed.Character.body.amount_dye_slots
      = (parsed.Character.body.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.hands?.amount_dye_slots) {
    parsed.Character.hands.amount_dye_slots
      = (parsed.Character.hands.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.legs?.amount_dye_slots) {
    parsed.Character.legs.amount_dye_slots
      = (parsed.Character.legs.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.feet?.amount_dye_slots) {
    parsed.Character.feet.amount_dye_slots
      = (parsed.Character.feet.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.earrings?.amount_dye_slots) {
    parsed.Character.earrings.amount_dye_slots
      = (parsed.Character.earrings.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.necklace?.amount_dye_slots) {
    parsed.Character.necklace.amount_dye_slots
      = (parsed.Character.necklace.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.bracelets?.amount_dye_slots) {
    parsed.Character.bracelets.amount_dye_slots
      = (parsed.Character.bracelets.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.ring1?.amount_dye_slots) {
    parsed.Character.ring1.amount_dye_slots
      = (parsed.Character.ring1.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  if (parsed.Character.ring2?.amount_dye_slots) {
    parsed.Character.ring2.amount_dye_slots
      = (parsed.Character.ring2.amount_dye_slots.split('<img')[0].match(/staining/g) || []).length
  }

  return parsed
}

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
