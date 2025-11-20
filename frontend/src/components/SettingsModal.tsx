import { useState, useEffect } from 'react';
import { getUserProfile, updateUserProfile, testDiscordNotification, sendCustomDiscordMessage, User } from '../api';
import { toast } from 'react-hot-toast';
import './SettingsModal.css';

interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingCustomMessage, setIsSendingCustomMessage] = useState(false);

  // Load current settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const profile = await getUserProfile();
      setDiscordWebhookUrl(profile.discord_webhook_url || '');
      setDiscordUserId(profile.discord_user_id || '');
      setCurrentUser(profile);
    } catch (error: any) {
      toast.error('Failed to load settings');
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateUserProfile({
        discord_webhook_url: discordWebhookUrl.trim() || null,
        discord_user_id: discordUserId.trim() || null
      });
      toast.success('Settings saved successfully!');
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save settings';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setDiscordWebhookUrl('');
    setDiscordUserId('');
  };

  const handleTest = async () => {
    if (!discordWebhookUrl.trim()) {
      toast.error('Please enter a Discord webhook URL first');
      return;
    }

    setIsTesting(true);
    try {
      const result = await testDiscordNotification();
      if (result.artwork) {
        toast.success(`Test notification sent! Check your Discord channel. Using: "${result.artwork.title}" by ${result.artwork.artist}`, {
          duration: 5000
        });
      } else {
        toast.success('Test notification sent! Check your Discord channel.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to send test notification';
      toast.error(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendCustomMessage = async () => {
    if (!customMessage.trim()) {
      toast.error('Enter a message first');
      return;
    }
    setIsSendingCustomMessage(true);
    try {
      await sendCustomDiscordMessage(customMessage.trim());
      toast.success('Custom Discord message sent!');
      setCustomMessage('');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to send custom message';
      toast.error(errorMessage);
    } finally {
      setIsSendingCustomMessage(false);
    }
  };

  const isSolana = currentUser?.username === 'Solana';

  return (
    <div className="modal-backdrop settings-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Settings</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="settings-section">
              <h3 className="settings-section-title">🔔 Discord Notifications</h3>
              <p className="settings-description">
                Configure Discord webhooks to receive notifications when artists you follow post new artwork.
                Notifications are only sent when checking for updates (not during initial imports).
              </p>

              <label htmlFor="discord-webhook" className="form-label">
                Discord Webhook URL
              </label>
              <input
                id="discord-webhook"
                type="url"
                className="form-input"
                placeholder="https://discord.com/api/webhooks/..."
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                disabled={isLoading || isSaving || isTesting}
              />
              <p className="form-hint">
                Create a webhook in your Discord server: Server Settings → Integrations → Webhooks → New Webhook
              </p>

              <label htmlFor="discord-user-id" className="form-label">
                Discord User ID (Optional)
              </label>
              <input
                id="discord-user-id"
                type="text"
                className="form-input"
                placeholder="123456789012345678"
                value={discordUserId}
                onChange={(e) => setDiscordUserId(e.target.value)}
                disabled={isLoading || isSaving || isTesting}
                pattern="\d{17,19}"
                title="Discord User ID should be 17-19 digits"
              />
              <p className="form-hint">
                Your Discord User ID for @mentions. Enable Developer Mode in Discord, then right-click your name → Copy User ID
              </p>

              <button
                type="button"
                className="btn btn-secondary test-notification-btn"
                onClick={handleTest}
                disabled={isLoading || isSaving || isTesting || !discordWebhookUrl.trim()}
                title="Send a test notification using your latest artwork from 'Latest from All Artists'"
              >
                {isTesting ? (
                  <>
                    <span className="spinner">⏳</span>
                    Testing...
                  </>
                ) : (
                  '🧪 Test Notification'
                )}
              </button>

              {isSolana && (
                <div className="solana-fun-zone">
                  <label htmlFor="custom-message" className="form-label">
                    Custom Discord Message
                  </label>
                  <p className="form-hint">
                    Send a one-off message straight to your Discord webhook. Only available for Solana.
                  </p>
                  <input
                    id="custom-message"
                    type="text"
                    className="form-input"
                    placeholder="Enter your masterpiece of chaos..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    disabled={isLoading || isSaving || isTesting || isSendingCustomMessage}
                    maxLength={2000}
                  />
                  <button
                    type="button"
                    className="btn btn-accent solana-send-btn"
                    onClick={handleSendCustomMessage}
                    disabled={
                      isLoading ||
                      isSaving ||
                      isTesting ||
                      isSendingCustomMessage ||
                      !customMessage.trim()
                    }
                  >
                    {isSendingCustomMessage ? 'Sending...' : 'Send Silly Message'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={isLoading || isSaving || isTesting}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving || isTesting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || isSaving || isTesting}
            >
              {isSaving ? (
                <>
                  <span className="spinner">⏳</span>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsModal;

