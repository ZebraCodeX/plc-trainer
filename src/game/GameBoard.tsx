import { useState } from 'react';
import { useGame } from '../store/hooks';
import type { AnyMission } from './mission-types';
import { MISSIONS } from './missions';
import { rankForXp, RANK_THRESHOLDS, type MissionResult } from './types';

export function GameBoard() {
  const { progress, startMission, reset } = useGame();
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');

  const completed = progress.completed;
  const rank = rankForXp(progress.xp);
  const totalStars = Object.values(completed).reduce((a, r) => a + r.stars, 0);
  const maxStars = MISSIONS.length * 3;

  const visible = MISSIONS.filter((m) => {
    if (filter === 'open') return !completed[m.id];
    if (filter === 'done') return !!completed[m.id];
    return true;
  });

  return (
    <div className="col">
      <div className="game-hero">
        <div className="game-hero-left">
          <div className="game-hero-codename">CAMPAIGN · LINE ZERO</div>
          <h1>PLCommando</h1>
          <p>
            You are the controls engineer on the night shift. Every machine on the line is
            misbehaving — rewrite the PLC logic, pass the behaviour tests, and keep production
            running. Faster, cleaner fixes earn more stars.
          </p>
        </div>
        <div className="game-hero-stats">
          <div className="game-stat">
            <span className="game-stat-value">{rank}</span>
            <span className="game-stat-label">Rank</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-value">{progress.xp}</span>
            <span className="game-stat-label">XP</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-value">
              {totalStars}/{maxStars}
            </span>
            <span className="game-stat-label">Stars</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-value">
              {Object.keys(completed).length}/{MISSIONS.length}
            </span>
            <span className="game-stat-label">Cleared</span>
          </div>
        </div>
      </div>

      <RankBar xp={progress.xp} />

      <div className="toolbar">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All missions
        </button>
        <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>
          Open
        </button>
        <button className={filter === 'done' ? 'active' : ''} onClick={() => setFilter('done')}>
          Completed
        </button>
        <div className="spacer" />
        <button
          className="danger"
          onClick={() => {
            if (confirm('Reset all campaign progress? This cannot be undone.')) reset();
          }}
        >
          Reset progress
        </button>
      </div>

      <div className="mission-grid">
        {visible.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            result={completed[mission.id]}
            onPlay={() => startMission(mission.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RankBar({ xp }: { xp: number }) {
  const next = RANK_THRESHOLDS.find((t) => t.xp > xp);
  const prev = [...RANK_THRESHOLDS].reverse().find((t) => t.xp <= xp) ?? RANK_THRESHOLDS[0];
  const pct = next ? ((xp - prev.xp) / (next.xp - prev.xp)) * 100 : 100;
  return (
    <div className="rank-bar">
      <div className="rank-bar-track">
        <div className="rank-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="rank-bar-label muted small">
        {next ? `${next.xp - xp} XP to ${next.rank}` : 'Maximum rank reached — Controls Lead'}
      </div>
    </div>
  );
}

function MissionCard({
  mission,
  result,
  onPlay,
}: {
  mission: AnyMission;
  result?: MissionResult;
  onPlay: () => void;
}) {
  const stars = result?.stars ?? 0;
  return (
    <div className={`mission-card diff-${mission.difficulty} ${result ? 'complete' : ''}`}>
      <div className="mission-card-top">
        <span className="mission-code mono">{mission.codename}</span>
        <span className="mission-diff">
          {'◆'.repeat(mission.difficulty)}
          <span className="muted">{'◇'.repeat(5 - mission.difficulty)}</span>
        </span>
      </div>
      <h3>{mission.title}</h3>
      <p className="muted small">{mission.brief}</p>
      <div className="mission-card-foot">
        <div className="stars" title={`${stars} of 3 stars`}>
          {[1, 2, 3].map((s) => (
            <span key={s} className={`star ${stars >= s ? 'on' : ''}`}>
              ★
            </span>
          ))}
        </div>
        <span className="badge">{mission.kind === 'st' ? 'ST' : 'LAD'}</span>
        <span className="badge reward">+{mission.reward} XP</span>
        <button className="primary" onClick={onPlay}>
          {result ? 'Replay' : 'Start shift'}
        </button>
      </div>
    </div>
  );
}

