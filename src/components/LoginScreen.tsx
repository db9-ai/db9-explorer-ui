import { useState, useCallback, type FormEvent } from 'react';

interface Props {
  onSubmit: (token: string) => void;
  error?: string | null;
}

export function LoginScreen({ onSubmit, error }: Props) {
  const [token, setToken] = useState('');

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (trimmed) onSubmit(trimmed);
  }, [token, onSubmit]);

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-title">
          <span>db<span className="dim">9</span></span>
          <span className="dim">Explorer</span>
        </div>
        <div className="connect-subtitle">Enter your API token to connect</div>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className="login-input"
            placeholder="db9_token_..."
            value={token}
            onChange={e => setToken(e.target.value)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            className="login-btn"
            disabled={!token.trim()}
          >
            Connect
          </button>
        </form>

        {error && <div className="connect-error">{error}</div>}
      </div>
    </div>
  );
}
