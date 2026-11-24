import { createChainPoller, type ChainReply, type ChainRequest } from '@/lib/chain-poller'

const poller = createChainPoller((reply: ChainReply) => self.postMessage(reply))

self.onmessage = (event: MessageEvent<ChainRequest>) => poller.handle(event.data)
