// Messages repository: the only database calls the messages module makes (chat between accounts).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type MessagesRepository = Pick<Api,
  'listMessages' | 'sendMessage' | 'markRead' | 'messageContacts' | 'deleteConversation' | 'subscribeReservations'>;

export const messagesRepo: MessagesRepository = api;
