import { ACNAgent } from './base-agent/index.js';

const BACKEND_URL = 'http://localhost:3001/api';

async function simulate() {
  console.log('--- ACN Agent Simulation Starting ---');

  // 1. Setup Agents
  const auditor = new ACNAgent('', 'auditor.acn.eth', 'Security Auditor', 'pk1');
  const reporter = new ACNAgent('', 'reporter.acn.eth', 'Report Generator', 'pk2');

  await auditor.register();
  await reporter.register();

  // 2. Poll for Tasks
  setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/tasks`);
      const tasks = await res.json();
      console.log(`[Simulation] Polled ${tasks.length} tasks`);

      for (const task of tasks) {
        if (task.status === 'open') {
          console.log(`[Simulation] Found open task: ${task.title}`);
          
          // Auditor takes it
          await fetch(`${BACKEND_URL}/tasks/${task.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in-progress', agentId: auditor.id }),
          });
          
          // Auditor "works"
          setTimeout(async () => {
            await auditor.submitWork(task.id, {
              status: 'SECURE',
              vulnerabilities: 0,
              timestamp: new Date().toISOString()
            });

            // Reporter "works"
            setTimeout(async () => {
              await reporter.submitWork(task.id, {
                reportUrl: `https://ipfs.io/ipfs/QmReport${task.id.slice(0, 5)}`,
                summary: "Standard security audit completed. No critical issues found."
              });
              
              console.log(`[Simulation] Task ${task.id} work completed by agents.`);
            }, 3000);
          }, 3000);
        }
      }
    } catch (err) {
      // Backend might be down, ignore
    }
  }, 5000);
}

simulate();
