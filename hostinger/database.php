<?php
declare(strict_types=1);

// Use Hostinger's official MongoDB PHP extension directly. No Composer install
// or library version tied to a newer server extension is needed.
final class SgDatabase {
    public function __construct(public MongoDB\Driver\Manager $manager, public string $name) {}
    public function collection(string $name): SgCollection { return new SgCollection($this, $name); }
    public function command(array $command, array $options = []): array {
        $cursor = $this->manager->executeCommand($this->name, new MongoDB\Driver\Command($command), $options);
        $cursor->setTypeMap(['root' => 'array', 'document' => 'array', 'array' => 'array']);
        return $cursor->toArray()[0];
    }
}

final class SgCollection {
    public function __construct(private SgDatabase $db, private string $name) {}
    public function find(array $filter = [], array $options = []): MongoDB\Driver\Cursor {
        $execution = [];
        if (isset($options['session'])) { $execution['session'] = $options['session']; unset($options['session']); }
        $cursor = $this->db->manager->executeQuery($this->db->name . '.' . $this->name, new MongoDB\Driver\Query((object)$filter, $options), $execution);
        $cursor->setTypeMap(['root' => 'array', 'document' => 'array', 'array' => 'array']);
        return $cursor;
    }
    public function findOne(array $filter, array $options = []): ?array {
        return $this->find($filter, [...$options, 'limit' => 1])->toArray()[0] ?? null;
    }
    private function write(MongoDB\Driver\BulkWrite $bulk, array $options = []): void {
        $this->db->manager->executeBulkWrite($this->db->name . '.' . $this->name, $bulk, $options);
    }
    public function insertOne(array $item, array $options = []): void {
        $bulk = new MongoDB\Driver\BulkWrite(); $bulk->insert($item); $this->write($bulk, $options);
    }
    public function updateOne(array $filter, array $update, array $options = []): void {
        $bulk = new MongoDB\Driver\BulkWrite();
        $bulk->update($filter, $update, ['multi' => false, 'upsert' => $options['upsert'] ?? false]);
        unset($options['upsert']); $this->write($bulk, $options);
    }
    public function deleteOne(array $filter): void {
        $bulk = new MongoDB\Driver\BulkWrite(); $bulk->delete($filter, ['limit' => 1]); $this->write($bulk);
    }
    public function createIndex(array $keys, array $options = []): void {
        $parts = []; foreach ($keys as $key => $direction) $parts[] = $key . '_' . $direction;
        $this->db->command(['createIndexes' => $this->name, 'indexes' => [['key' => $keys, 'name' => implode('_', $parts), ...$options]]]);
    }
    public function incrementAttempt(string $id, MongoDB\BSON\UTCDateTime $expires): int {
        $result = $this->db->command(['findAndModify' => $this->name, 'query' => ['_id' => $id],
            'update' => ['$inc' => ['count' => 1], '$setOnInsert' => ['expiresAt' => $expires]], 'upsert' => true, 'new' => true]);
        return $result['value']['count'];
    }
}
