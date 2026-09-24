#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'

// The receiver's read API is loopback-only by design.
const BASE = `http://127.0.0.1:${process.env.RAY_PORT ?? 23517}`

async function read(path) {
  let response

  try {
    response = await fetch(`${BASE}${path}`)
  } catch {
    throw new Error(
      `The NetOS Debug receiver is not reachable on ${BASE}. Start the app and try again.`,
    )
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`The receiver answered ${response.status} for ${path}`)
  }

  return response.json()
}

/*
 * Small shaping helpers. They intentionally duplicate a little of the
 * renderer's logic: this file runs as its own dependency-free process and
 * cannot import the app's TypeScript.
 */
function stripDump(value) {
  if (typeof value !== 'string') {
    return value
  }

  return value.includes('class=sf-dump')
    ? value
        .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim()
    : value
}

/** ray ships a plain-text rendering of logged values for exactly this purpose. */
function clipboardData(content) {
  const value = Array.isArray(content?.meta) ? content.meta[0]?.clipboard_data : null

  return typeof value === 'string' && value !== '' ? value : null
}

function summarise(event) {
  const content = event.content ?? {}
  const shipped = clipboardData(content)

  if (shipped) {
    return shipped
  }

  switch (event.type) {
    case 'exception':
      return `${content.class ?? 'Exception'}: ${content.message ?? ''}`
    case 'executed_query':
      return String(content.sql ?? '')
    case 'table':
      return Object.entries(content.values ?? {})
        .map(([key, value]) => `${key}: ${stripDump(value)}`)
        .join('\n')
    case 'custom':
      return stripDump(content.content)
    default:
      return JSON.stringify(content)
  }
}

function where(event) {
  const origin = event.origin ?? {}

  return `${origin.file ?? 'unknown'}:${origin.line_number ?? '?'} on ${origin.hostname ?? 'unknown host'}`
}

function describe(event) {
  const tags = [event.label && `label: ${event.label}`, event.color && `colour: ${event.color}`]
    .filter(Boolean)
    .join(', ')

  return [
    `[${event.type}] ${new Date(event.receivedAt).toISOString()}  id=${event.id}`,
    `  from ${where(event)}${tags ? `  (${tags})` : ''}`,
    summarise(event)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n'),
  ].join('\n')
}

function describeException(event) {
  const content = event.content ?? {}
  const frames = Array.isArray(content.frames) ? content.frames : []
  const application = frames.filter((frame) => !frame.vendor_frame)
  const shown = (application.length > 0 ? application : frames).slice(0, 12)

  const parts = [
    `${content.class ?? 'Exception'}: ${content.message ?? ''}`,
    `Thrown at ${where(event)}`,
    '',
    'Stack trace:',
    ...shown.map(
      (frame, index) =>
        `#${index} ${frame.file_name}:${frame.line_number}` +
        (frame.class || frame.method
          ? ` — ${frame.class ?? ''}${frame.class && frame.method ? '::' : ''}${frame.method ?? ''}`
          : ''),
    ),
  ]

  if (frames.length > shown.length) {
    parts.push(`(${frames.length - shown.length} vendor frames omitted)`)
  }

  const withSnippet = shown.find((frame) => frame.snippet?.length)

  if (withSnippet) {
    parts.push(
      '',
      `Code around ${withSnippet.file_name}:${withSnippet.line_number}:`,
      ...withSnippet.snippet.map(
        (line) => `${String(line.line_number).padStart(4)} | ${line.text}`,
      ),
    )
  }

  return parts.join('\n')
}

const text = (value) => ({ content: [{ type: 'text', text: value }] })

/*
 * Claude Code spawns this process over stdio, so the app has no way to observe
 * it. Announcing ourselves is what turns "connected" in the settings view into
 * a real signal rather than a guess.
 */
const HEARTBEAT_MS = 10_000

async function heartbeat() {
  try {
    await fetch(`${BASE}/api/mcp/heartbeat`, { method: 'POST' })
  } catch {
    // The receiver may not be running yet; stay quiet and try again later.
  }
}

function createServer() {
  const server = new McpServer({ name: 'netos-ray', version: '0.1.0' })

  server.registerTool(
    'list_ray_events',
    {
      description:
        'List recent spatie/ray payloads received by the NetOS Debug app, newest first. Use this to see what the application just dumped, logged or queried.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).optional(),
        type: z
          .string()
          .optional()
          .describe('Filter by payload type, e.g. exception, log, executed_query, table'),
      }),
    },
    async ({ limit, type }) => {
      const data = await read(
        `/api/events?limit=${limit ?? 20}${type ? `&type=${encodeURIComponent(type)}` : ''}`,
      )
      const events = data?.events ?? []

      if (events.length === 0) {
        return text('No ray payloads have been received yet.')
      }

      return text(events.map(describe).join('\n\n'))
    },
  )

  server.registerTool(
    'get_last_exception',
    {
      description:
        'Get the most recent exception received from the application, with its stack trace and the code around the failing line.',
      inputSchema: z.object({}),
    },
    async () => {
      const event = await read('/api/last-exception')

      return text(event ? describeException(event) : 'No exception has been received yet.')
    },
  )

  server.registerTool(
    'get_ray_event',
    {
      description:
        'Get the full payload of one ray event by its id, as returned by list_ray_events.',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      const event = await read(`/api/events/${encodeURIComponent(id)}`)

      if (!event) {
        return text(`No event with id ${id} is still in the buffer.`)
      }

      return text(
        event.type === 'exception'
          ? describeException(event)
          : `${describe(event)}\n\nRaw payload:\n${JSON.stringify(event.content, null, 2)}`,
      )
    },
  )

  return server
}

void serveStdio(createServer)

void heartbeat()
setInterval(heartbeat, HEARTBEAT_MS).unref()
console.error(`netos-ray MCP server running on stdio, reading from ${BASE}`)
