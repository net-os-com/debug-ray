import { choiceKey, type MockChoices, type MockEndpoint, type MockResponse } from './types'

export function activeResponse(
  service: string,
  endpoint: MockEndpoint,
  choices: MockChoices,
): MockResponse | null {
  const chosen = endpoint.responses.find(
    (response) => response.id === choices[choiceKey(service, endpoint.id)],
  )

  return chosen ?? endpoint.responses[0] ?? null
}
