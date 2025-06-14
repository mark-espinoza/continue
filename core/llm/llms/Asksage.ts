import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  TextMessagePart,
} from "../../index.js";
import { BaseLLM } from "../index.js";

class Asksage extends BaseLLM {
  static providerName = "askSage";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.asksage.ai/server/",
    model: "gpt-4o",
  };

  private static modelConversion: { [key: string]: string } = {
    "google-gemini-20-flash": "google-gemini-20-flash",
    "google-gemini-2.5-pro": "google-gemini-2.5-pro",
    "claude-3-5-sonnet-latest": "claude-35-sonnet",
    "claude-3-opus-20240229": "claude-3-opus",
    "claude-3-sonnet-20240229": "claude-3-sonnet",
  };

  constructor(options: LLMOptions) {
    super(options);
    this.apiVersion = options.apiVersion ?? "v1.2.4";
  }

  protected _convertModelName(model: string): string {
    console.log("Converting model:", model);
    const convertedModel = Asksage.modelConversion[model] ?? model;
    console.log("Converted model:", convertedModel);
    return convertedModel;
  }

  protected _convertMessage(message: ChatMessage) {
    return {
      user: message.role === "assistant" ? "gpt" : "me",
      message:
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((part) => part.type === "text")
              .map((part) => (part as TextMessagePart).text)
              .join(""),
    };
  }

  protected _convertArgs(options: any, messages: ChatMessage[]) {
    let formattedMessage: any;
    if (messages.length === 1) {
      formattedMessage = messages[0].content;
    } else {
      formattedMessage = messages.map(this._convertMessage);
    }

    const args: any = {
      message: formattedMessage,
      persona: options.persona ?? "default",
      dataset: options.dataset ?? "none",
      limit_references: options.limitReferences ?? 0,
      temperature: options.temperature ?? 0.0,
      live: options.live ?? 0,
      model: this._convertModelName(options.model),
      system_prompt:
        options.systemPrompt ??
        "You are an expert software developer. You give helpful and concise responses.",
      tools: options.tools,
      tool_choice: options.toolChoice,
    };

    Object.keys(args).forEach(
      (key) => args[key] === undefined && delete args[key],
    );

    return args;
  }

  protected _getHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["x-access-tokens"] = this.apiKey;
    }

    return headers;
  }

  protected _getEndpoint(endpoint: string) {
    if (!this.apiBase) {
      throw new Error(
        "No API base URL provided. Please set the 'apiBase' option.",
      );
    }

    return new URL(endpoint, this.apiBase);
  }

  protected async _complete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): Promise<string> {
    if (typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error("Prompt must be a non-empty string.");
    }

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];

    const args = this._convertArgs(options, messages);

    const response = await this.fetch(this._getEndpoint("query"), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.message;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const completion = await this._complete(prompt, signal, options);
    yield completion;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const args = this._convertArgs(options, messages);

    const response = await this.fetch(this._getEndpoint("query"), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(args),
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: data.message,
    };

    yield assistantMessage;
  }

  async listModels(): Promise<string[]> {
    return Object.keys(Asksage.modelConversion);
  }
}

export default Asksage;
