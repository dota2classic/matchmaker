/* tslint:disable */
/* eslint-disable */
/**
 * GameServer api
 * Matches, players, mmrs
 *
 * The version of the OpenAPI document: 1.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import {
  GameserverPlayerTeammateDto,
  GameserverPlayerTeammateDtoFromJSON,
  GameserverPlayerTeammateDtoToJSON
} from "./";

/**
 *
 * @export
 * @interface GameserverPlayerTeammatePage
 */
export class GameserverPlayerTeammatePage {
    /**
     *
     * @type {Array<GameserverPlayerTeammateDto>}
     * @memberof GameserverPlayerTeammatePage
     */
    data: Array<GameserverPlayerTeammateDto>;
    /**
     *
     * @type {number}
     * @memberof GameserverPlayerTeammatePage
     */
    page: number;
    /**
     *
     * @type {number}
     * @memberof GameserverPlayerTeammatePage
     */
    perPage: number;
    /**
     *
     * @type {number}
     * @memberof GameserverPlayerTeammatePage
     */
    pages: number;
}

export function GameserverPlayerTeammatePageFromJSON(json: any): GameserverPlayerTeammatePage {
    return GameserverPlayerTeammatePageFromJSONTyped(json, false);
}

export function GameserverPlayerTeammatePageFromJSONTyped(json: any, ignoreDiscriminator: boolean): GameserverPlayerTeammatePage {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {

        'data': ((json['data'] as Array<any>).map(GameserverPlayerTeammateDtoFromJSON)),
        'page': json['page'],
        'perPage': json['perPage'],
        'pages': json['pages'],
    };
}

export function GameserverPlayerTeammatePageToJSON(value?: GameserverPlayerTeammatePage | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {

        'data': ((value.data as Array<any>).map(GameserverPlayerTeammateDtoToJSON)),
        'page': value.page,
        'perPage': value.perPage,
        'pages': value.pages,
    };
}


