/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1220150045")

  // add field
  collection.fields.addAt(8, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3325602110",
    "hidden": false,
    "id": "relation948476334",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "responders",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1220150045")

  // remove field
  collection.fields.removeById("relation948476334")

  return app.save(collection)
})
