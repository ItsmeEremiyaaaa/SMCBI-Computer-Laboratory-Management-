import { createMock } from '../../shared/data/mock';
import { conversations } from './hooks/useMessages';

describe('messages', () => {
  it('a student writes to the lab admin, gets a reply, and reading marks it seen; students cannot write to students', async () => {
    const api = createMock(null);
    await api.signIn('c230001@smcbi.edu.ph', 'x');
    const contacts = await api.messageContacts();
    expect(contacts.some((c) => c.role === 'student')).toBe(false);
    expect(contacts[0]).toMatchObject({ id: 'admin', role: 'admin' });
    await api.sendMessage('admin', '  Can I book PC-05 tomorrow?  ');
    await expect(api.sendMessage('student', 'hi')).rejects.toThrow(/yourself|Students can message/);

    await api.signIn('admin@smcbi.edu.ph', 'x');
    const inbox = await api.listMessages();
    const q = inbox.find((m) => m.from_id === 'student')!;
    expect(q).toMatchObject({ body: 'Can I book PC-05 tomorrow?', from_name: '4th Year Student 001', read_at: null });
    await api.markRead('student');
    expect((await api.listMessages()).find((m) => m.id === q.id)!.read_at).not.toBeNull();
    await api.sendMessage('student', 'Yes, send the request.');

    await api.signIn('c230001@smcbi.edu.ph', 'x');
    const convs = conversations(await api.listMessages(), 'student');
    expect(convs).toHaveLength(1); // the welcome message, the question and the reply are one chat with the admin
    expect(convs[0]).toMatchObject({ id: 'admin', name: 'Lab Administrator', unread: 2 });
    expect(convs[0].last.body).toBe('Yes, send the request.');
  });
});
