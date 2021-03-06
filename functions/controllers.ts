import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { Label } from '../types/global';

export class Controller {
  async fetchMemberApi (uuid: string): Promise<{ id: string; labels: Label[] }> {
    const members = await this.server.ghostAdminAPI.members.browse({ filter: `uuid:${uuid}` })

    return members[0]
  }

  constructor(private server: FastifyInstance) {}


  async fetchLabelsApi (uuid: string): Promise<Label[]> {
    const member = await this.fetchMemberApi(uuid)
    const labels: Label[] = (member?.labels ?? []).map(({ name }) => ({ name }))

    if (labels.length) this.server.cache.set(uuid, labels)

    return labels
  }

  async getLabels(request: FastifyRequest, reply: FastifyReply) {
    const uuid: string = encodeURIComponent((request.params as any).userId)
    const labels: Label[] = this.server.cache.get(uuid) ?? await this.fetchLabelsApi(uuid)

    return reply.send(labels)
  }

  async updateLabels(request: FastifyRequest, reply: FastifyReply) {
    const uuid: string = encodeURIComponent((request.params as any).userId)
    const member = await this.fetchMemberApi(uuid)
    const labels: Label[] = request.body as any
    const data = { id: member?.id, labels }
    const labelsSetSize = new Set([...labels, ...member?.labels].map(({ name }) => name)).size
    const sameLabel = labelsSetSize === labels.length &&  labelsSetSize === member?.labels.length

    console.log(sameLabel)

    if (sameLabel) {
      this.server.cache.set(uuid, member.labels.map(({ name }) => ({ name })))
      return reply.send(labels)
    }

    const response = await this.server.ghostAdminAPI.members.edit(data, { include: encodeURIComponent('labels,email_recipients') })

    this.server.cache.set(uuid, labels)

    return reply.send(response.labels.map(({ name }: Label) => ({ name })))
  }

  async updateLabelsWebhook(request: FastifyRequest, reply: FastifyReply) {
    const member = (request.body as any).member.current
    const uuid: string = encodeURIComponent(member.uuid)
    const labels: Label[] = member.labels
    const response = labels.map(({ name }) => ({ name }))

    this.server.cache.set(uuid, response)

    return reply.send(labels)
  }
}
