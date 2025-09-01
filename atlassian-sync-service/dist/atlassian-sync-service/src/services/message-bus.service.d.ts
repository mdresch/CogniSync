declare class MessageBusService {
    private logger;
    private serviceBusClient;
    private sender;
    constructor();
    sendMessage(message: {
        body: any;
        messageId?: string;
    }): Promise<void>;
    close(): Promise<void>;
}
export declare const messageBusService: MessageBusService;
export {};
//# sourceMappingURL=message-bus.service.d.ts.map