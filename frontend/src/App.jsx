
import { Component } from "react";
import "./App.css";

// Temporary Google Colab backend URL.
// Update this if your Colab runtime generates a new URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// Development only. Never use a frontend-exposed token in production.
const API_TOKEN = import.meta.env.VITE_API_TOKEN;
class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      niche: "Artificial Intelligence",
      audience: "College students and fresh graduates",
      goal: "Create educational Instagram Reels",
      duration: "60",
      message: "",
      loading: false,
      error: "",
      generatedContent: null,
      runId: null,
      history: [],
      historyLoading: false,
      historyError: "",
      jsonCopied: false,
      deletingId: null
    };
  }
componentDidMount() {
  this.fetchHistory();
}
handleDeleteReel = async (reelId) => {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete Reel #${reelId}?`
  );

  if (!confirmed) return;

  this.setState({ deletingId: reelId });

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/reel/${reelId}`,
      {
        method: "DELETE",
        headers: {
          "X-API-Token": API_TOKEN
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to delete Reel");
    }

    this.setState((prevState) => ({
      history: prevState.history.filter(
        (item) => item.id !== reelId
      ),
      generatedContent:
        prevState.generatedContent?.reel_id === reelId
          ? null
          : prevState.generatedContent,
      runId:
        prevState.runId === reelId
          ? null
          : prevState.runId,
      message: "Reel deleted successfully!",
      deletingId: null
    }));

  } catch (error) {
    console.error("Delete error:", error);

    this.setState({
      historyError: error.message,
      deletingId: null
    });
  }
};
fetchHistory = async () => {
  this.setState({
    historyLoading: true,
    historyError: ""
  });

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/history`,
      {
        method: "GET",
        headers: {
          "X-API-Token": API_TOKEN
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load history");
    }

    this.setState({
      history: data.reels || [],
      historyLoading: false
    });

  } catch (error) {
    console.error("History error:", error);

    this.setState({
      historyLoading: false,
      historyError: error.message
    });
  }
}
  handleChange = (event) => {
    this.setState({
      [event.target.name]: event.target.value
    });
  };

  // Find generated content even if the API wraps it in result/data.
  getOutputValue = (possibleKeys) => {
    const response = this.state.generatedContent;

    if (!response || typeof response !== "object") {
      return null;
    }

    const sources = [
  response,
  response.reel,
  response.data,
  response.result,
  response.content,
  response.generated_content,
  response.full_result,
  response.outputs
];

    for (const source of sources) {
      if (!source || typeof source !== "object") continue;

      for (const key of possibleKeys) {
        if (source[key] !== undefined && source[key] !== null) {
          return source[key];
        }
      }
    }

    return null;
  };
handleCopyJson = async () => {
  const reel = this.state.generatedContent?.reel;

  if (!reel) return;

  try {
    const jsonOutput = JSON.stringify(reel, null, 2);

    await navigator.clipboard.writeText(jsonOutput);

    this.setState({ jsonCopied: true });

  } catch (error) {
    console.error("Copy failed:", error);
    this.setState({ jsonCopied: false });
    alert("Unable to copy JSON. Please try again.");
  }
};
  formatOutput = (value) => {
    if (typeof value === "string") return value;

    if (value === null || value === undefined) {
      return "No content returned.";
    }

    return JSON.stringify(value, null, 2);
  };

  handleGenerate = async (event) => {
    event.preventDefault();

    const { niche, audience, goal, duration } = this.state;

    this.setState({
      loading: true,
      error: "",
      message: "Your AI agents are working...",
      jsonCopied: false
    });

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
             "X-API-Token": API_TOKEN
          },
          body: JSON.stringify({
  reel_theme: niche,
  target_audience: audience,
  content_goal: goal,
  duration_seconds: Number(duration)
})
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Backend request failed (${response.status})`
        );
      }

      this.setState({
  generatedContent: data,
  runId: data.reel_id || null,
  message: data.message || "AI content generated successfully!",
  loading: false
});

    } catch (error) {
      console.error("Generation error:", error);

      this.setState({
        loading: false,
        error: error.message || "Something went wrong.",
        message: ""
      });
    }
  };

  render() {
    
    const {
      niche,
      audience,
      goal,
      duration,
      message,
      loading,
      error,
      generatedContent,
      runId,
      history,
      historyLoading,
      historyError,
      deletingId
    } = this.state;
    const reel = generatedContent?.reel || null;
    const ideas = this.getOutputValue([
      "content_ideas",
      "ideas",
      "contentIdeas"
    ]);

    const script = this.getOutputValue([
      "reel_script",
      "script",
      "reelScript"
    ]);

    const report = this.getOutputValue([
      "engagement_report",
      "optimization_report",
      "engagementReport"
    ]);

    const hasStructuredResults = ideas || script || report;

    return (
      <div className="app-layout">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">✦</div>
            <span>
              InstaPilot<span className="brand-ai"> AI</span>
            </span>
          </div>

          <div className="nav-section">
            <p className="nav-label">WORKSPACE</p>

            <div className="nav-item active">
              <span>◫</span> Dashboard
            </div>

            <div className="nav-item">
              <span>✧</span> Content Generator
            </div>

            <div className="nav-item">
              <span>▤</span> Content Library
            </div>

            <div className="nav-item">
              <span>◷</span> History
            </div>
          </div>

          <div className="sidebar-bottom">
            <div className="plan-card">
              <div className="plan-icon">✦</div>
              <h4>InstaPilot AI</h4>
              <p>Your AI-powered content studio.</p>
              <span className="plan-status">MVP WORKSPACE</span>
            </div>

            <div className="profile">
              <div className="avatar">M</div>
              <div>
                <h4>Creator</h4>
                <p>Workspace account</p>
              </div>
              <span className="profile-menu">•••</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">

          <header className="topbar">
            <div>
              <p className="breadcrumb">Workspace / Dashboard</p>
            </div>

            <div className="topbar-right">
              <span className="system-status">
                <span className="status-dot"></span>
                AI Workspace
              </span>
              <div className="top-avatar">M</div>
            </div>
          </header>

          <div className="dashboard-content">

            {/* WELCOME */}
            <section className="welcome-section">
              <div>
                <p className="eyebrow">YOUR AI CONTENT STUDIO</p>
                <h1>
                  Create smarter. <span>Grow faster.</span>
                </h1>
                <p className="welcome-description">
                  Turn your ideas into engaging Instagram content
                  with your AI-powered creative team.
                </p>
              </div>

              <div className="welcome-decoration">✦</div>
            </section>

            {/* STATS */}
            <section className="stats-grid">

              <div className="stat-card">
                <div className="stat-heading">
                  <span>Total generations</span>
                  <span className="stat-icon purple">✧</span>
                </div>
                <h2>{runId ? "03+" : "02"}</h2>
                <p>AI content runs saved</p>
              </div>

              <div className="stat-card">
                <div className="stat-heading">
                  <span>AI agents</span>
                  <span className="stat-icon blue">◈</span>
                </div>
                <h2>03</h2>
                <p>Active CrewAI agents</p>
              </div>

              <div className="stat-card">
                <div className="stat-heading">
                  <span>Content pipeline</span>
                  <span className="stat-icon green">↗</span>
                </div>
                <h2>Ready</h2>
                <p>Ideas → Scripts → Optimization</p>
              </div>

            </section>

            {/* GENERATOR */}
            <section className="workspace-grid">

              <div className="panel generator-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">AI CONTENT ENGINE</p>
                    <h2>Generate new content</h2>
                    <p className="panel-description">
                      Tell your AI team what you want to create.
                    </p>
                  </div>

                  <div className="heading-icon">✦</div>
                </div>

                <form onSubmit={this.handleGenerate}>

                  <div className="form-group">
                    <label>CONTENT NICHE</label>
                    <input
                      type="text"
                      name="niche"
                      value={niche}
                      onChange={this.handleChange}
                      placeholder="e.g. Technology, Fitness..."
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>TARGET AUDIENCE</label>
                    <input
                      type="text"
                      name="audience"
                      value={audience}
                      onChange={this.handleChange}
                      placeholder="Who are you creating for?"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>CONTENT GOAL</label>
                    <textarea
                      name="goal"
                      value={goal}
                      onChange={this.handleChange}
                      placeholder="Describe your content goal..."
                      rows="3"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>REEL DURATION</label>
                    <select
                      name="duration"
                      value={duration}
                      onChange={this.handleChange}
                    >
                      <option value="15">15 seconds</option>
                      <option value="30">30 seconds</option>
                      <option value="45">45 seconds</option>
                      <option value="60">60 seconds</option>
                      <option value="90">90 seconds</option>
                    </select>
                  </div>

                  <button
                    className="generate-button"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <span>⏳ AI agents are working...</span>
                    ) : (
                      <span>✦ Generate with AI →</span>
                    )}
                  </button>

                  {message && (
                    <p className="form-message">{message}</p>
                  )}

                  {error && (
                    <p className="api-error">{error}</p>
                  )}

                </form>
              </div>

              {/* AI AGENTS */}
              <div className="right-column">

                <div className="panel agents-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">YOUR CREATIVE TEAM</p>
                      <h2>AI Agents</h2>
                    </div>
                    <span className="live-label">● ACTIVE</span>
                  </div>

                  <div className="agent-item">
                    <div className="agent-icon idea">✧</div>
                    <div className="agent-info">
                      <h4>Content Ideator</h4>
                      <p>Creates fresh content ideas</p>
                    </div>
                    <span className="agent-number">01</span>
                  </div>

                  <div className="agent-item">
                    <div className="agent-icon script">▤</div>
                    <div className="agent-info">
                      <h4>Script Writer</h4>
                      <p>Transforms ideas into Reel scripts</p>
                    </div>
                    <span className="agent-number">02</span>
                  </div>

                  <div className="agent-item">
                    <div className="agent-icon optimize">↗</div>
                    <div className="agent-info">
                      <h4>Engagement Optimizer</h4>
                      <p>Improves hooks and CTAs</p>
                    </div>
                    <span className="agent-number">03</span>
                  </div>
                </div>

                {/* WORKFLOW */}
                <div className="panel pipeline-panel">
                  <p className="eyebrow">HOW IT WORKS</p>
                  <h2>Your AI workflow</h2>

                  <div className="pipeline">
                    <div className="pipeline-step">
                      <span className="pipeline-dot">1</span>
                      <div>
                        <h4>Generate ideas</h4>
                        <p>Discover creative topics</p>
                      </div>
                    </div>

                    <div className="pipeline-line"></div>

                    <div className="pipeline-step">
                      <span className="pipeline-dot">2</span>
                      <div>
                        <h4>Write scripts</h4>
                        <p>Create engaging storytelling</p>
                      </div>
                    </div>

                    <div className="pipeline-line"></div>

                    <div className="pipeline-step">
                      <span className="pipeline-dot">3</span>
                      <div>
                        <h4>Optimize content</h4>
                        <p>Improve content quality</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </section>

           

  {reel && (
  <section className="panel generated-results">

    <div className="section-heading">
      <div>
        <p className="eyebrow">YOUR AI-GENERATED REEL</p>
        <h2>{reel.reel_title}</h2>

        <p className="panel-description">
          Reel ID: {generatedContent.reel_id} |
          Duration: {reel.total_duration_seconds} seconds
        </p>
      </div>

      <button
        className="copy-json-button"
        type="button"
        onClick={this.handleCopyJson}
      >
        {this.state.jsonCopied ? "✓ Copied!" : "📋 Copy JSON"}
      </button>
    </div>

    <div className="json-container">
      <div className="json-header">
        <span>📄 JSON OUTPUT</span>
        <span>application/json</span>
      </div>

      <pre className="json-output">
        {JSON.stringify(reel, null, 2)}
      </pre>
    </div>

  </section>
)}
            {/* HISTORY */}
           {/* CONTENT LIBRARY / HISTORY */}
<section className="panel history-panel">

  <div className="section-heading">
    <div>
      <p className="eyebrow">YOUR WORKSPACE</p>
      <h2>Your Content Library</h2>
      <p className="panel-description">
        All your previously generated Instagram Reels.
      </p>
    </div>

    <button
      className="generate-button"
      type="button"
      onClick={this.fetchHistory}
      disabled={historyLoading}
    >
      {historyLoading ? "Loading..." : "↻ Refresh"}
    </button>
  </div>

  <div className="history-summary">
    <h3>{history.length} Saved Reels</h3>
  </div>

  {historyLoading && (
    <p className="form-message">
      Loading your saved content...
    </p>
  )}

  {historyError && (
    <p className="api-error">
      {historyError}
    </p>
  )}

  {!historyLoading && !historyError && history.length === 0 && (
    <div className="history-placeholder">
      <div className="history-icon">▤</div>
      <div>
        <h4>No saved Reels yet</h4>
        <p>Generate your first Reel to see it here.</p>
      </div>
    </div>
  )}

  <div className="history-list">
    {history.map((item) => (
      <div className="history-card" key={item.id}>

        <div className="history-card-info">
          <span className="history-id">
            REEL #{item.id}
          </span>

          <h3>{item.reel_title}</h3>

          <p>
            Theme: {item.reel_theme}
          </p>

          <p>
            Duration: {item.duration} seconds
          </p>
        </div>

       <div className="history-card-status">

  <span className="live-label">
    ● {item.status}
  </span>

  <button
    className="delete-button"
    type="button"
    onClick={() => this.handleDeleteReel(item.id)}
    disabled={deletingId === item.id}
  >
    {deletingId === item.id ? (
      "Deleting..."
    ) : (
      <>
        🗑 Delete
      </>
    )}
  </button>

</div>

      </div>
    ))}
  </div>

</section>

            <footer className="footer">
              <p>© 2026 InstaPilot AI. Built with intelligence.</p>
              <p>Powered by CrewAI + Gemini</p>
            </footer>

          </div>
        </main>
      </div>
    );
  }
}

export default App;
