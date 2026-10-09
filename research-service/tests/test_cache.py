import unittest

from src.services.cache import ResponseCacheService


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.ttls = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = value
        self.ttls[key] = ex
        return True

    async def delete(self, key):
        self.values.pop(key, None)


class FailingRedis:
    async def get(self, key):
        raise ConnectionError("offline")

    async def set(self, key, value, ex=None):
        raise ConnectionError("offline")


class ResponseCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_cache_round_trip_and_ttl(self):
        redis = FakeRedis()
        cache = ResponseCacheService(redis_client=redis, default_ttl=120)
        response = {"content": "hello", "tokens": 12}
        await cache.set_response_cache("tenant-a", "model-a", "Hello", response)
        self.assertEqual(await cache.get_cached_response("tenant-a", "model-a", "Hello"), response)
        self.assertEqual(set(redis.ttls.values()), {120})

    async def test_tenant_isolation(self):
        redis = FakeRedis()
        cache = ResponseCacheService(redis_client=redis)
        await cache.set_response_cache("tenant-a", "model-a", "same prompt", {"content": "private"})
        self.assertIsNone(await cache.get_cached_response("tenant-b", "model-a", "same prompt"))

    async def test_key_normalizes_whitespace_without_exposing_prompt(self):
        first = ResponseCacheService._generate_cache_key("u", "m", "hello   world")
        second = ResponseCacheService._generate_cache_key("u", "m", "hello" + chr(10) + "world")
        self.assertEqual(first, second)
        self.assertNotIn("hello", first)

    async def test_model_and_system_instruction_are_part_of_key(self):
        key = ResponseCacheService._generate_cache_key("u", "m1", "prompt", "policy")
        self.assertNotEqual(key, ResponseCacheService._generate_cache_key("u", "m2", "prompt", "policy"))
        self.assertNotEqual(key, ResponseCacheService._generate_cache_key("u", "m1", "prompt", "different policy"))

    async def test_redis_failure_is_best_effort(self):
        cache = ResponseCacheService(redis_client=FailingRedis())
        self.assertIsNone(await cache.get_cached_response("u", "m", "prompt"))
        await cache.set_response_cache("u", "m", "prompt", {"content": "answer"})

    async def test_empty_responses_are_not_cached(self):
        redis = FakeRedis()
        cache = ResponseCacheService(redis_client=redis)
        await cache.set_response_cache("u", "m", "prompt", {"content": ""})
        self.assertEqual(redis.values, {})


if __name__ == "__main__":
    unittest.main()
