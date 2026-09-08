import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

function PlayGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M6 3L17 10L6 17V3Z" fill="white" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="wrapper">
      <div id="big-text">
        <h1>{siteConfig.name}</h1>
        <p>{siteConfig.tagline}</p>

        <div className="btn-row">
          <Link className="play-icon-btn" href="/play" aria-label="Play">
            <PlayGlyph size={22} />
          </Link>
          <Link className="le-btn play-btn" href="/leaderboard">
            LEADERBOARD
          </Link>
        </div>

        <div className="btn-row" style={{ marginTop: 6 }}>
          <Link
            className="play-icon-btn small-icon"
            href="/api-keys"
            aria-label="API keys"
          >
            <PlayGlyph size={16} />
          </Link>
          <Link className="le-btn play-btn small-btn" href="/api-keys">
            API KEYS
          </Link>
        </div>

        <span className="coming-soon" style={{ cursor: "default" }}>
          {siteConfig.ticker}: COMING SOON
        </span>
      </div>

      <a
        href={siteConfig.twitter}
        target="_blank"
        rel="noopener noreferrer"
        className="twitter-link"
        aria-label={`${siteConfig.name} on X`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      <div
        id="texture"
        style={{
          backgroundImage: "url('/texture.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div id="clouds" />
      <div id="hole" />
      <div id="moon" />

      <div id="hand">
        <div className="text">
          <span className="sign-text">
            PLAY
            <br />
            NOW!
          </span>
          <Link className="hand-play-btn" href="/play">
            ▶ START
          </Link>
        </div>
      </div>

      <div id="grass" />
      <div id="grass2" />
    </div>
  );
}
