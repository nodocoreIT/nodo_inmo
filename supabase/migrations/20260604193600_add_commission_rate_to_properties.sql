-- Migration to add commission_rate (percentage) to properties table.
-- Used to define the commission for rentals or intermediation fees for sales.

alter table nodo_inmo.properties
add column commission_rate numeric(5, 2) default null;
