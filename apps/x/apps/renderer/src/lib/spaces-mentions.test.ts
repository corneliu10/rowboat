import { describe, expect, it } from 'vitest'
import { containsRowboatAddress } from './spaces-mentions'

describe('containsRowboatAddress', () => {
    it('is the token the composer emits, anywhere outside code', () => {
        expect(containsRowboatAddress('[@spinball](#spinball) move SSO to P1')).toBe(true)
        expect(containsRowboatAddress('yes — [@spinball](#spinball) move SSO to P1')).toBe(true)
        expect(containsRowboatAddress('([@spinball](#spinball) can you tidy this?)')).toBe(true)
    })

    it('never the bare word — that is prose, not an address', () => {
        expect(containsRowboatAddress('@spinball move SSO to P1')).toBe(false)
        expect(containsRowboatAddress('we should ship spaces this week')).toBe(false)
        expect(containsRowboatAddress('the spinball brand is growing on me')).toBe(false)
        expect(containsRowboatAddress('mail me at team@spinball.com')).toBe(false)
    })

    it('code is citation, not address', () => {
        expect(containsRowboatAddress('the trigger is `[@spinball](#spinball)` in a message')).toBe(false)
        expect(containsRowboatAddress('```\n[@spinball](#spinball) do the thing\n```')).toBe(false)
        expect(containsRowboatAddress('```ts\nsend("[@spinball](#spinball) hi")')).toBe(false) // unterminated fence
    })
})
