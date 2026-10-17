/**
 * Slash commands in the event chat (Phase 8.2). Parsed here, in the app; each
 * command then calls its own database function, which does all the checking.
 * Add a command to COMMANDS when its feature ships, so /help and the
 * suggestions only ever offer what works.
 */

export type CommandName = 'poll' | 'split' | 'bill' | 'here' | 'remind' | 'plan' | 'help';

export type Command = {
  name: CommandName;
  usage: string;
  description: string;
  hostOnly?: boolean;
};

export const COMMANDS: Command[] = [
  { name: 'poll', usage: '/poll Where should we eat? Thai / Pizza / Sushi', description: 'Start a poll (2 to 6 options, split with /)' },
  { name: 'split', usage: '/split 120 Dinner', description: "Split a bill you paid evenly; on its own, /split lets everyone tick what they had. They pay you back by PayID" },
  { name: 'bill', usage: '/bill pizza 24, 2 beers 26, service 10%', description: 'Type out a bill you paid; everyone ticks what they had (on its own, /bill opens Bills)' },
  { name: 'plan', usage: '/plan', description: 'Show the plan: what happens when, and who\'s running late' },
  { name: 'here', usage: '/here', description: "Tell the host you've arrived (from 2 hours before the start)" },
  { name: 'remind', usage: '/remind', description: "Nudge everyone who hasn't answered (once every 12 hours)", hostOnly: true },
  { name: 'help', usage: '/help', description: 'What you can type here' },
];

export type ParsedCommand =
  | { name: 'poll'; question: string; options: string[] }
  | { name: 'split'; scan?: false; totalCents: number; description: string }
  // "/split" on its own: an itemised bill (8.18)
  | { name: 'split'; scan: true }
  // "/bill pizza 24, beer 12" (8.18): the text is parsed by lib/billText.ts
  | { name: 'bill'; text: string }
  | { name: 'here' }
  | { name: 'remind' }
  | { name: 'plan' }
  | { name: 'help' }
  | { name: 'error'; message: string }
  | { name: 'unknown'; typed: string; suggestion?: Command };

/** Commands this person can use (some are for the host only). */
export const commandsFor = (isHost: boolean) => COMMANDS.filter((c) => isHost || !c.hostOnly);

/** Commands matching what's been typed so far, for the suggestions above the input. */
export function suggestCommands(text: string, isHost: boolean): Command[] {
  if (!text.startsWith('/') || text.includes(' ')) return [];
  const typed = text.slice(1).toLowerCase();
  return commandsFor(isHost).filter((c) => c.name.startsWith(typed));
}

/** null when the text isn't a command (send it as a normal message). */
export function parseCommand(text: string, isHost: boolean): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const [head, ...rest] = trimmed.slice(1).split(/\s+/);
  const name = head.toLowerCase();
  const body = rest.join(' ').trim();
  const known = commandsFor(isHost).find((c) => c.name === name);

  if (!known) {
    // Closest by prefix either way ("/pol", "/polls")
    const suggestion = commandsFor(isHost).find((c) => c.name.startsWith(name) || name.startsWith(c.name));
    return { name: 'unknown', typed: name, suggestion };
  }
  if (known.name === 'help') return { name: 'help' };
  if (known.name === 'here') return { name: 'here' };
  if (known.name === 'remind') return { name: 'remind' };
  if (known.name === 'plan') return { name: 'plan' };
  if (known.name === 'split') return parseSplit(body);
  if (known.name === 'bill') return { name: 'bill', text: body };
  return parsePoll(body);
}

// "/split 120 Dinner", "/split $45.50 taxi home", "/split 30" (-> "Shared cost"), "/split" (itemised)
function parseSplit(body: string): ParsedCommand {
  if (!body) return { name: 'split', scan: true };
  const match = body.match(/^\$?\s*(\d+(?:[.,]\d{1,2})?)\s*(.*)$/);
  if (!match) return { name: 'error', message: 'Start with the amount you paid, like: /split 120 Dinner' };
  const totalCents = Math.round(parseFloat(match[1].replace(',', '.')) * 100);
  if (totalCents < 1 || totalCents > 1_000_000) return { name: 'error', message: 'The total must be between $0.01 and $10,000' };
  const description = match[2].trim() || 'Shared cost';
  if (description.length > 80) return { name: 'error', message: 'Keep what it was for under 80 characters' };
  return { name: 'split', totalCents, description };
}

// "/poll Where should we eat? Thai / Pizza / Sushi"  -> question + 3 options
// "/poll Thai / Pizza / Sushi"                        -> "Quick poll" + 3 options
// "/poll Friday or Saturday: Fri / Sat"               -> a colon works like the question mark
function parsePoll(body: string): ParsedCommand {
  if (!body) return { name: 'error', message: 'Add some options, like: /poll Where should we eat? Thai / Pizza / Sushi' };
  let question = 'Quick poll';
  let rest = body;
  // The question can only come before the first option separator
  const firstSlash = body.indexOf('/');
  const head = firstSlash === -1 ? body : body.slice(0, firstSlash);
  const mark = head.lastIndexOf('?');
  const colon = head.indexOf(':');
  if (mark > 0) {
    question = body.slice(0, mark + 1).trim();
    rest = body.slice(mark + 1);
  } else if (colon > 0) {
    question = body.slice(0, colon).trim();
    rest = body.slice(colon + 1);
  }
  const options = rest.split(rest.includes('/') ? '/' : ',').map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) return { name: 'error', message: 'A poll needs at least 2 options, split with /' };
  if (options.length > 6) return { name: 'error', message: 'A poll can have up to 6 options' };
  if (question.length > 120) return { name: 'error', message: 'Keep the question under 120 characters' };
  const long = options.find((o) => o.length > 60);
  if (long) return { name: 'error', message: `"${long.slice(0, 20)}…" is too long (60 characters max per option)` };
  return { name: 'poll', question, options };
}
