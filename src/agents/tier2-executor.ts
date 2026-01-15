import { anthropic } from '../lib/anthropic';
import { config } from '../config/env';
import { SSEStream } from '../utils/sse';
import { logger } from '../utils/logger';
import {
  buildEmailSystemPrompt,
  buildEmailUserPrompt,
  EmailBrief,
} from './templates/email.template';
import {
  buildAdSystemPrompt,
  buildAdUserPrompt,
  AdBrief,
} from './templates/ad.template';
import {
  buildLandingPageSystemPrompt,
  buildLandingPageUserPrompt,
  LandingPageBrief,
} from './templates/landing-page.template';
import {
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
  ScriptBrief,
} from './templates/script.template';

export type ContentType = 'email' | 'ad' | 'landing-page' | 'script';

export interface ContentExecutionInput {
  contentType: ContentType;
  brief: EmailBrief | AdBrief | LandingPageBrief | ScriptBrief;
}

export interface ContentExecutionOutput {
  content: string;
  title: string;
  metadata: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
  };
}

/**
 * Tier 2: Content Execution Agent
 * 
 * Stateless specialist agent for generating marketing content
 * Uses Claude 3.5 Haiku for fast, cost-effective generation
 */
export class Tier2Executor {
  private stream: SSEStream;

  constructor(stream: SSEStream) {
    this.stream = stream;
  }

  /**
   * Execute content generation based on content type and brief
   */
  async execute(input: ContentExecutionInput): Promise<ContentExecutionOutput> {
    const startTime = Date.now();

    this.stream.send({
      event: 'analysis',
      data: {
        type: 'content_generation_start',
        content: `Generating ${input.contentType} content...`,
      },
    });

    try {
      // Get system and user prompts based on content type
      const { systemPrompt, userPrompt, title } = this.buildPrompts(input);

      // Call Haiku for content generation with streaming
      const response = await this.generateContent(systemPrompt, userPrompt);

      const generationTimeMs = Date.now() - startTime;

      this.stream.send({
        event: 'analysis',
        data: {
          type: 'content_generated',
          content: `✅ ${input.contentType} generated in ${generationTimeMs}ms`,
        },
      });

      return {
        content: response.content,
        title,
        metadata: {
          model: response.model,
          tokensUsed: response.tokensUsed,
          generationTimeMs,
        },
      };
    } catch (error: any) {
      logger.error('Tier 2 content generation failed', {
        error: error.message,
        contentType: input.contentType,
      });

      this.stream.error(error.message || 'Content generation failed');

      throw new Error(`Content generation failed: ${error.message}`);
    }
  }

  /**
   * Build system and user prompts based on content type
   */
  private buildPrompts(input: ContentExecutionInput): {
    systemPrompt: string;
    userPrompt: string;
    title: string;
  } {
    switch (input.contentType) {
      case 'email':
        const emailBrief = input.brief as EmailBrief;
        return {
          systemPrompt: buildEmailSystemPrompt(),
          userPrompt: buildEmailUserPrompt(emailBrief),
          title: `Email: ${emailBrief.purpose}`,
        };

      case 'ad':
        const adBrief = input.brief as AdBrief;
        return {
          systemPrompt: buildAdSystemPrompt(),
          userPrompt: buildAdUserPrompt(adBrief),
          title: `${adBrief.platform} Ad: ${adBrief.objective}`,
        };

      case 'landing-page':
        const lpBrief = input.brief as LandingPageBrief;
        return {
          systemPrompt: buildLandingPageSystemPrompt(),
          userPrompt: buildLandingPageUserPrompt(lpBrief),
          title: `Landing Page: ${lpBrief.productService}`,
        };

      case 'script':
        const scriptBrief = input.brief as ScriptBrief;
        return {
          systemPrompt: buildScriptSystemPrompt(),
          userPrompt: buildScriptUserPrompt(scriptBrief),
          title: `${scriptBrief.format} Script: ${scriptBrief.purpose}`,
        };

      default:
        throw new Error(`Unknown content type: ${input.contentType}`);
    }
  }

  /**
   * Generate content using Claude Haiku with streaming
   */
  private async generateContent(
    systemPrompt: string,
    userPrompt: string
  ): Promise<{
    content: string;
    model: string;
    tokensUsed: number;
  }> {
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Start artifact streaming
    this.stream.send({
      event: 'artifact',
      data: {
        type: 'start',
        content: '',
      },
    });

    // Stream content generation
    const stream = await anthropic.messages.stream({
      model: config.models.tier2,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Process streaming events
    for await (const event of stream) {
      if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          const chunk = event.delta.text;
          fullContent += chunk;

          // Stream artifact chunks to frontend
          this.stream.send({
            event: 'artifact',
            data: {
              type: 'delta',
              content: chunk,
            },
          });
        }
      } else if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
      }
    }

    // End artifact streaming
    this.stream.send({
      event: 'artifact',
      data: {
        type: 'end',
        content: '',
      },
    });

    return {
      content: fullContent,
      model: config.models.tier2,
      tokensUsed: inputTokens + outputTokens,
    };
  }
}

