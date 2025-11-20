import { useState } from 'react';
import { login, register } from '../api';
import { toast } from 'react-hot-toast';
import './LoginModal.css';

interface LoginModalProps {
  onLogin: () => void;
}

function LoginModal({ onLogin }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [artstationUsername, setArtstationUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegistering) {
        // Register new user
        await register(username.trim(), artstationUsername.trim() || undefined);
        toast.success(`Welcome, ${username}!`);
        onLogin();
      } else {
        // Login existing user
        await login(username.trim());
        toast.success(`Welcome back, ${username}!`);
        onLogin();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to authenticate';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop login-backdrop">
      <div className="modal login-modal">
        <div className="modal-header">
          <h2>🎨 ArtTracker</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="login-description">
              {isRegistering 
                ? 'Create your account to start tracking artists' 
                : 'Enter your username to access your tracker'}
            </p>
            
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={isLoading}
              pattern="[a-zA-Z0-9_]+"
              title="Only letters, numbers, and underscores allowed"
            />
            
            {isRegistering && (
              <>
                <label htmlFor="artstation-username" className="form-label">
                  ArtStation Username (Optional)
                </label>
                <input
                  id="artstation-username"
                  type="text"
                  className="form-input"
                  placeholder="Your ArtStation username (for importing)"
                  value={artstationUsername}
                  onChange={(e) => setArtstationUsername(e.target.value)}
                  disabled={isLoading}
                />
                <p className="form-hint">
                  This will be saved but not displayed. You can change it later.
                </p>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsRegistering(!isRegistering)}
              disabled={isLoading}
            >
              {isRegistering ? 'Already have an account? Login' : 'New user? Register'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" aria-hidden="true"></span>
                  {isRegistering ? 'Creating...' : 'Logging in...'}
                </>
              ) : (
                isRegistering ? 'Register' : 'Login'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;

