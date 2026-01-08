import { FastifyReply } from 'fastify';
import { SSEEvent } from '../types/index.js';

/**
 * SSE (Server-Sent Events) utility for streaming responses
 */
export class SSEStream {
  private reply: FastifyReply;

  constructor(reply: FastifyReply) {
    this.reply = reply;
    this.initializeStream();
  }

  private initializeStream() {
    this.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
  }

  /**
   * Send an SSE event
   */
  send(event: SSEEvent) {
    const { event: eventName, data } = event;
    this.reply.raw.write(`event: ${eventName}\n`);
    this.reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Send thinking event
   */
  thinking(type: 'agent_reasoning' | 'tool_status', content: string, tool?: string) {
    this.send({
      event: 'thinking',
      data: { type, content, ...(tool && { tool }) },
    });
  }

  /**
   * Send analysis event
   */
  analysis(type: 'research_summary' | 'knowledge_summary', content: string, sources?: any[]) {
    this.send({
      event: 'analysis',
      data: { type, content, ...(sources && { sources }) },
    });
  }

  /**
   * Send artifact event
   */
  artifact(type: 'start' | 'delta' | 'end', artifactId: string, content?: string, metadata?: any) {
    this.send({
      event: 'artifact',
      data: { type, artifactId, ...(content && { content }), ...(metadata && { metadata }) },
    });
  }

  /**
   * Send message event
   */
  message(content: string, messageId: string) {
    this.send({
      event: 'message',
      data: { role: 'assistant', content, messageId },
    });
  }

  /**
   * Send error event
   */
  error(error: string, code?: string, details?: any) {
    this.send({
      event: 'error',
      data: { error, ...(code && { code }), ...(details && { details }) },
    });
  }

  /**
   * Send done event
   */
  done(conversationId: string, messageCount: number) {
    this.send({
      event: 'done',
      data: { conversationId, messageCount },
    });
  }

  /**
   * Close the stream
   */
  close() {
    this.reply.raw.end();
  }
}

