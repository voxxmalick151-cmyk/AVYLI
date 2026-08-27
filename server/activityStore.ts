import { ActivityLog } from '../src/types.js';

class ActivityStore {
  private logs: ActivityLog[] = [];
  private maxLogs = 300;

  constructor() {
    // Initial friendly system log
    this.add({
      type: 'info',
      action: 'Sistema Iniciado',
      friendlyMessage: 'KING Yampi Manager inicializado com sucesso e pronto para operações.',
      technicalDetails: {
        method: 'SYSTEM_BOOT',
        statusCode: 200,
        payload: { timestamp: new Date().toISOString() }
      }
    });
  }

  public add(log: Omit<ActivityLog, 'id' | 'timestamp' | 'timeFormatted'>): ActivityLog {
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const fullTimestamp = now.toLocaleString('pt-BR');

    const newLog: ActivityLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: fullTimestamp,
      timeFormatted,
      ...log,
    };

    this.logs.unshift(newLog);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    return newLog;
  }

  public getAll(): ActivityLog[] {
    return this.logs;
  }

  public clear(): void {
    this.logs = [];
    this.add({
      type: 'info',
      action: 'Logs Limpos',
      friendlyMessage: 'O histórico de atividades foi redefinido pelo usuário.',
    });
  }
}

export const activityStore = new ActivityStore();
