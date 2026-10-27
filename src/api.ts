import { createClient } from '@supabase/supabase-js'
import type { Board, GameInput, PaymentInput, ExpenseInput } from './domain'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase) throw new Error('A base de dados ainda não está configurada.')
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}
export const api = {
  board: (code: string) => rpc<Board>('get_board', { p_code: code }),
  myGroup: () => rpc<string | null>('my_group_code'),
  createGroup: (name: string, playerName: string) =>
    rpc<{ invite_code: string; player_id: string; token: string }>(
      'create_group',
      { p_name: name, p_player_name: playerName },
    ),
  join: (
    code: string,
    name: string,
    external: boolean,
    invitedBy: string | null,
  ) =>
    rpc<{ player_id: string; token: string }>('join_group', {
      p_code: code,
      p_name: name,
      p_external: external,
      p_invited_by: invitedBy,
    }),
  isAdmin: (groupId: string) =>
    rpc<boolean>('is_group_admin', { p_group_id: groupId }),
  rsvp: (token: string, gameId: string, status: string) =>
    rpc('respond_to_game', {
      p_token: token,
      p_game_id: gameId,
      p_status: status,
    }),
  async adminRsvp(gameId: string, playerId: string, status: string) {
    await rpc('admin_respond_to_game', {
      p_game_id: gameId,
      p_player_id: playerId,
      p_status: status,
    })
  },
  recordPayment: (payment: PaymentInput) =>
    rpc<string>('record_payment', {
      p_player_id: payment.player_id,
      p_amount_cents: payment.amount_cents,
      p_paid_on: payment.paid_on,
      p_note: payment.note,
    }),
  voidPayment: (id: string, reason: string) =>
    rpc('void_payment', { p_payment_id: id, p_reason: reason }),
  recordExpense: (groupId: string, expense: ExpenseInput) =>
    rpc<string>('record_expense', {
      p_group_id: groupId,
      p_amount_cents: expense.amount_cents,
      p_paid_on: expense.paid_on,
      p_description: expense.description,
    }),
  voidExpense: (id: string, reason: string) =>
    rpc('void_expense', { p_expense_id: id, p_reason: reason }),
  merge: (sourceId: string, targetId: string) =>
    rpc<string>('merge_players', {
      p_source_id: sourceId,
      p_target_id: targetId,
    }),
  manageAdmin: (groupId: string, email: string, admin: boolean) =>
    rpc('manage_group_admin', {
      p_group_id: groupId,
      p_email: email,
      p_admin: admin,
    }),
  grantMerge: (groupId: string, email: string, allowed: boolean) =>
    rpc('grant_merge_permission', {
      p_group_id: groupId,
      p_email: email,
      p_allowed: allowed,
    }),
  async game(groupId: string, game: GameInput) {
    await rpc('create_game', {
      p_group_id: groupId,
      p_starts_at: game.starts_at,
      p_location: game.location,
      p_capacity: game.capacity,
      p_fee_cents: 0,
      p_note: game.note,
    })
  },
  addPlayer: (
    code: string,
    name: string,
    external: boolean,
    invitedBy: string | null,
  ) =>
    rpc<{ player_id: string; token: string }>('admin_add_player', {
      p_code: code,
      p_name: name,
      p_external: external,
      p_invited_by: invitedBy,
    }),
  playerLink: (playerId: string) =>
    rpc<string>('rotate_player_token', { p_player_id: playerId }),
  addAdmin: (groupId: string, email: string) =>
    rpc('add_group_admin', { p_group_id: groupId, p_email: email }),
}
