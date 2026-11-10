/** A small room chat: friends are probably on a voice call, so it stays light. */
import { useEffect, useRef, useState } from 'react';
import { useRace } from '../game/store';

export function ChatBox() {
  const { chat, me, send } = useRace();
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [chat.length]);
  return (
    <div className="chat">
      <div className="chat__lines" aria-live="polite">
        {chat.length === 0 && <div className="chat__empty">No messages yet.</div>}
        {chat.map((c) => (
          <div
            key={c.id}
            className={c.playerId === me ? 'chat__line chat__line--me' : 'chat__line'}
          >
            <b>{c.playerId === me ? 'You' : c.name}</b> {c.text}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          send({ type: 'chat', text: t.slice(0, 500) });
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          maxLength={500}
          aria-label="Chat message"
        />
        <button className="btn" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
